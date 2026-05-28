"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const User_1 = __importDefault(require("../models/User"));
const TokenBlocklist_1 = __importDefault(require("../models/TokenBlocklist"));
const EmailVerification_1 = __importStar(require("../models/EmailVerification"));
const auth_1 = require("../middleware/auth");
const emailService_1 = require("../services/emailService");
const router = (0, express_1.Router)();
// ── Validation schemas ────────────────────────────────────────────────────
const RegisterSchema = zod_1.z.object({
    username: zod_1.z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, or hyphens'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters'),
    displayName: zod_1.z
        .string()
        .min(1, 'Display name must be at least 1 character')
        .max(30, 'Display name must be at most 30 characters'),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
// ── Constants ─────────────────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const TOKEN_EXPIRY = '30d';
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// ── Helpers ───────────────────────────────────────────────────────────────
function signToken(userId, username) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET environment variable is not set');
    return jsonwebtoken_1.default.sign({ userId, username }, secret, {
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
router.post('/register', async (req, res) => {
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
        const existingEmail = await User_1.default.findOne({ email }).lean();
        if (existingEmail) {
            res.status(409).json({
                error: { code: 'EMAIL_ALREADY_IN_USE', message: 'An account with this email address already exists.' },
            });
            return;
        }
        const existingUsername = await User_1.default.findOne({ username }).lean();
        if (existingUsername) {
            res.status(409).json({
                error: { code: 'USERNAME_ALREADY_IN_USE', message: 'This username is already taken.' },
            });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(password, 12);
        const user = await User_1.default.create({
            username,
            email,
            passwordHash,
            displayName,
            failedLoginAttempts: 0,
            isEmailVerified: false,
        });
        // Create verification token (expires in 24 hours)
        const token = (0, EmailVerification_1.generateVerificationToken)();
        await EmailVerification_1.default.create({
            userId: user._id,
            token,
            expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        });
        // Send verification email — only if RESEND_API_KEY is configured
        let emailSent = false;
        if (process.env.RESEND_API_KEY) {
            try {
                await (0, emailService_1.sendVerificationEmail)(email, displayName, token);
                emailSent = true;
            }
            catch (emailErr) {
                console.warn('[Auth] Could not send verification email:', emailErr);
            }
        }
        else {
            // No email service configured — auto-verify the account so users aren't blocked
            await User_1.default.findByIdAndUpdate(user._id, { isEmailVerified: true });
            await EmailVerification_1.default.deleteOne({ userId: user._id });
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
    }
    catch (err) {
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
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
        res.status(400).json({
            error: { code: 'MISSING_TOKEN', message: 'Verification token is required.' },
        });
        return;
    }
    try {
        const record = await EmailVerification_1.default.findOne({ token });
        if (!record) {
            res.status(400).json({
                error: { code: 'INVALID_TOKEN', message: 'This verification link is invalid or has expired.' },
            });
            return;
        }
        // Mark user as verified
        await User_1.default.findByIdAndUpdate(record.userId, { isEmailVerified: true });
        // Delete the used token
        await EmailVerification_1.default.deleteOne({ _id: record._id });
        // Return a simple success page (Flutter deep link can handle this)
        res.status(200).json({
            message: 'Email verified successfully. You can now log in.',
        });
    }
    catch (err) {
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
router.post('/resend-verification', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.userId);
        if (!user) {
            res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
            return;
        }
        if (user.isEmailVerified) {
            res.status(400).json({ error: { code: 'ALREADY_VERIFIED', message: 'Email is already verified.' } });
            return;
        }
        // Delete any existing token for this user
        await EmailVerification_1.default.deleteMany({ userId: user._id });
        // Create a new token
        const token = (0, EmailVerification_1.generateVerificationToken)();
        await EmailVerification_1.default.create({
            userId: user._id,
            token,
            expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        });
        await (0, emailService_1.sendVerificationEmail)(user.email, user.displayName, token);
        res.status(200).json({ message: 'Verification email sent.' });
    }
    catch (err) {
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
router.post('/login', async (req, res) => {
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
        const user = await User_1.default.findOne({ email });
        if (!user) {
            res.status(401).json(invalidCredentialsResponse);
            return;
        }
        // Account lockout check
        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) {
            const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000);
            res.status(429).json({
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message: `Account locked. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
                },
            });
            return;
        }
        const passwordMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!passwordMatch) {
            const newFailedCount = user.failedLoginAttempts + 1;
            const updateFields = {
                failedLoginAttempts: newFailedCount,
            };
            if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
                updateFields.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
            }
            await User_1.default.updateOne({ _id: user._id }, { $set: updateFields });
            res.status(401).json(invalidCredentialsResponse);
            return;
        }
        // Reset lockout on success
        await User_1.default.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockedUntil: undefined } });
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
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
        });
    }
});
// ── POST /auth/logout ─────────────────────────────────────────────────────
router.post('/logout', auth_1.authenticateToken, async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        res.status(401).json({ error: { code: 'MISSING_TOKEN', message: 'Authentication token is required.' } });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.decode(token);
        const jti = payload?.jti ?? token;
        const expiresAt = payload?.exp
            ? new Date(payload.exp * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await TokenBlocklist_1.default.updateOne({ jti }, { $set: { jti, expiresAt } }, { upsert: true });
        res.status(200).json({ message: 'Logged out successfully.' });
    }
    catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' },
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map