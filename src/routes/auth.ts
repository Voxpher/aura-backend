import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import User from '../models/User';
import TokenBlocklist from '../models/TokenBlocklist';
import EmailVerification, { generateVerificationToken } from '../models/EmailVerification';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { sendVerificationEmail } from '../services/emailService';

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────

const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, or hyphens'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z
    .string()
    .min(1, 'Display name must be at least 1 character')
    .max(30, 'Display name must be at most 30 characters'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── Constants ─────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const TOKEN_EXPIRY = '30d';
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Helpers ───────────────────────────────────────────────────────────────

function signToken(userId: string, username: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign({ userId, username }, secret, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

// ── POST /auth/register ───────────────────────────────────────────────────

/**
 * Register a new user account.
 *
 * - Validates all fields
 * - Hashes password with bcrypt (cost 12)
 * - Creates user with isEmailVerified = false
 * - Sends a verification email via Resend
 * - Returns a JWT (user can use the app but email is unverified)
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message ?? 'Invalid input.',
      },
    });
    return;
  }

  const { username, email, password, displayName } = parsed.data;

  try {
    const existingEmail = await User.findOne({ email }).lean();
    if (existingEmail) {
      res.status(409).json({
        error: { code: 'EMAIL_ALREADY_IN_USE', message: 'An account with this email address already exists.' },
      });
      return;
    }

    const existingUsername = await User.findOne({ username }).lean();
    if (existingUsername) {
      res.status(409).json({
        error: { code: 'USERNAME_ALREADY_IN_USE', message: 'This username is already taken.' },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      email,
      passwordHash,
      displayName,
      failedLoginAttempts: 0,
      isEmailVerified: false,
    });

    // Create verification token (expires in 24 hours)
    const token = generateVerificationToken();
    await EmailVerification.create({
      userId: user._id,
      token,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });

    // Send verification email — only if RESEND_API_KEY is configured
    let emailSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        await sendVerificationEmail(email, displayName, token);
        emailSent = true;
      } catch (emailErr) {
        console.warn('[Auth] Could not send verification email:', emailErr);
      }
    } else {
      // No email service configured — auto-verify the account so users aren't blocked
      await User.findByIdAndUpdate(user._id, { isEmailVerified: true });
      await EmailVerification.deleteOne({ userId: user._id });
      console.info('[Auth] RESEND_API_KEY not set — account auto-verified for:', email);
    }

    const jwt_token = signToken(String(user._id), user.username);

    res.status(201).json({
      token: jwt_token,
      emailVerificationSent: emailSent,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        isEmailVerified: !process.env.RESEND_API_KEY, // true when no email service
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  }
});

// ── GET /auth/verify-email?token=xxx ─────────────────────────────────────

/**
 * Verify a user's email address using the token from the verification email.
 *
 * - Finds the token in EmailVerification collection
 * - Marks user.isEmailVerified = true
 * - Deletes the used token
 * - Returns a success message (Flutter app can redirect to login)
 */
router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    res.status(400).json({
      error: { code: 'MISSING_TOKEN', message: 'Verification token is required.' },
    });
    return;
  }

  try {
    const record = await EmailVerification.findOne({ token });

    if (!record) {
      res.status(400).json({
        error: { code: 'INVALID_TOKEN', message: 'This verification link is invalid or has expired.' },
      });
      return;
    }

    // Mark user as verified
    await User.findByIdAndUpdate(record.userId, { isEmailVerified: true });

    // Delete the used token
    await EmailVerification.deleteOne({ _id: record._id });

    // Return a simple success page (Flutter deep link can handle this)
    res.status(200).json({
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  }
});

// ── POST /auth/resend-verification ───────────────────────────────────────

/**
 * Resend the verification email to the authenticated user.
 * Useful if the original email expired or was lost.
 */
router.post('/resend-verification', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({ error: { code: 'ALREADY_VERIFIED', message: 'Email is already verified.' } });
      return;
    }

    // Delete any existing token for this user
    await EmailVerification.deleteMany({ userId: user._id });

    // Create a new token
    const token = generateVerificationToken();
    await EmailVerification.create({
      userId: user._id,
      token,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });

    await sendVerificationEmail(user.email, user.displayName, token);

    res.status(200).json({ message: 'Verification email sent.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────

/**
 * Authenticate a user and return a signed JWT.
 * Includes account lockout after 5 failed attempts.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input.' },
    });
    return;
  }

  const { email, password } = parsed.data;

  const invalidCredentialsResponse = {
    error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
  };

  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json(invalidCredentialsResponse);
      return;
    }

    // Account lockout check
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
      res.status(429).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account locked. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
        },
      });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      const newFailedCount = user.failedLoginAttempts + 1;
      const updateFields: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: newFailedCount,
      };
      if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
        updateFields.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
      }
      await User.updateOne({ _id: user._id }, { $set: updateFields });
      res.status(401).json(invalidCredentialsResponse);
      return;
    }

    // Reset lockout on success
    await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockedUntil: undefined } });

    const token = signToken(String(user._id), user.username);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Authentication token is required.' } });
    return;
  }

  try {
    const payload = jwt.decode(token) as { jti?: string; exp?: number } | null;
    const jti = payload?.jti ?? token;
    const expiresAt = payload?.exp
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await TokenBlocklist.updateOne({ jti }, { $set: { jti, expiresAt } }, { upsert: true });

    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
    });
  }
});

export default router;
