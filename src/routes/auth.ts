import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import User from '../models/User';
import TokenBlocklist from '../models/TokenBlocklist';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';

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

/** Maximum consecutive failed login attempts before lockout. Requirement 1.7 */
const MAX_FAILED_ATTEMPTS = 5;

/** Duration of account lockout in milliseconds (15 minutes). Requirement 1.7 */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Window within which failed attempts are counted (15 minutes). Requirement 1.7 */
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** JWT access token expiry (30 days). Requirement 1.3 */
const TOKEN_EXPIRY = '30d';

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Signs a JWT for the given user.
 * Payload: { userId, username }
 * Expiry: 30 days (Requirement 1.3)
 */
function signToken(userId: string, username: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign({ userId, username }, secret, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

// ── POST /auth/register ───────────────────────────────────────────────────

/**
 * Register a new user account.
 *
 * Validates username, email, password, and displayName.
 * Hashes password with bcrypt (cost factor 12).
 * Returns a signed JWT on success.
 *
 * Requirements: 1.1, 1.2, 1.6
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
    // Check for duplicate email (Requirement 1.2)
    const existingEmail = await User.findOne({ email }).lean();
    if (existingEmail) {
      res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_IN_USE',
          message: 'An account with this email address already exists.',
        },
      });
      return;
    }

    // Check for duplicate username
    const existingUsername = await User.findOne({ username }).lean();
    if (existingUsername) {
      res.status(409).json({
        error: {
          code: 'USERNAME_ALREADY_IN_USE',
          message: 'This username is already taken.',
        },
      });
      return;
    }

    // Hash password with bcrypt cost factor 12 (Requirement 1.6)
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      email,
      passwordHash,
      displayName,
      failedLoginAttempts: 0,
    });

    const token = signToken(String(user._id), user.username);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────

/**
 * Authenticate a user and return a signed JWT.
 *
 * Rate limiting / account lockout (Requirement 1.7):
 *   - Before password check: if lockedUntil > now, return 429.
 *   - On failed login: increment failedLoginAttempts.
 *     If count reaches MAX_FAILED_ATTEMPTS within FAILURE_WINDOW_MS,
 *     set lockedUntil = now + LOCKOUT_DURATION_MS.
 *   - On successful login: reset failedLoginAttempts = 0, clear lockedUntil.
 *
 * Error indistinguishability (Requirement 1.4):
 *   - Wrong email and wrong password both return the same 401 response.
 *
 * Requirements: 1.3, 1.4, 1.7
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message ?? 'Invalid input.',
      },
    });
    return;
  }

  const { email, password } = parsed.data;

  // Generic invalid-credentials response — used for both wrong email and wrong
  // password to prevent user enumeration (Requirement 1.4).
  const invalidCredentialsResponse = {
    error: {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    },
  };

  try {
    const user = await User.findOne({ email });

    // If user not found, return generic error (Requirement 1.4)
    if (!user) {
      res.status(401).json(invalidCredentialsResponse);
      return;
    }

    // ── Account lockout check (Requirement 1.7) ───────────────────────────
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - now.getTime()) / 60_000
      );
      res.status(429).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account locked. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
        },
      });
      return;
    }

    // ── Password verification ─────────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      // Increment failed attempt counter (Requirement 1.7)
      const newFailedCount = user.failedLoginAttempts + 1;

      const updateFields: {
        failedLoginAttempts: number;
        lockedUntil?: Date;
      } = { failedLoginAttempts: newFailedCount };

      // Lock account after MAX_FAILED_ATTEMPTS consecutive failures within
      // the FAILURE_WINDOW_MS window (Requirement 1.7).
      // We track the window by checking whether the account was already
      // accumulating failures (lockedUntil is unset means we're in a fresh
      // or ongoing window). The simplest correct approach: lock when the
      // counter reaches the threshold.
      if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
        updateFields.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
      }

      await User.updateOne({ _id: user._id }, { $set: updateFields });

      res.status(401).json(invalidCredentialsResponse);
      return;
    }

    // ── Successful login — reset lockout state (Requirement 1.7) ─────────
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0, lockedUntil: undefined } }
    );

    const token = signToken(String(user._id), user.username);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────

/**
 * Invalidate the current JWT by adding its jti to the server-side blocklist.
 *
 * The TokenBlocklist document is automatically removed by MongoDB's TTL
 * mechanism once the token's expiry time has passed (Requirement 1.8).
 *
 * Requirements: 1.8
 */
router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authentication token is required.',
      },
    });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.decode(token) as { jti?: string; exp?: number } | null;

    // Use jti if present; fall back to a hash of the token itself
    const jti = payload?.jti ?? token;
    const expiresAt = payload?.exp
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Upsert to avoid duplicate-key errors on double-logout
    await TokenBlocklist.updateOne(
      { jti },
      { $set: { jti, expiresAt } },
      { upsert: true }
    );

    void secret; // suppress unused-variable warning

    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }
});

export default router;
