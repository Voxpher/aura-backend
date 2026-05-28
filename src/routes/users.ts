import { Router, Request, Response } from 'express';
import multer from 'multer';

import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  getPublicProfile,
  updateProfile,
  uploadAvatar,
  searchUsers,
  registerDeviceToken,
} from '../services/profileService';

const router = Router();

// ── Multer configuration ───────────────────────────────────────────────────

/** Accepted MIME types for avatar uploads (Requirement 9.1) */
const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/** Maximum avatar file size: 5 MB (Requirement 9.1) */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Unsupported file type. Accepted formats: JPEG, PNG, GIF, WebP.'
        )
      );
    }
  },
});

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Extracts the HTTP status code from a service-layer error.
 * Falls back to 500 for unexpected errors.
 */
function statusFrom(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}

function codeFrom(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code;
  }
  return 'INTERNAL_ERROR';
}

function messageFrom(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /users/search?q=
 *
 * Search users by username prefix (case-insensitive).
 * Returns up to 20 matching profiles within 1 second.
 *
 * Requirements: 8.1
 */
router.get(
  '/search',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';

    try {
      const results = await searchUsers(q);
      res.json({ users: results });
    } catch (err) {
      res.status(statusFrom(err)).json({
        error: { code: codeFrom(err), message: messageFrom(err) },
      });
    }
  }
);

/**
 * GET /users/:id
 *
 * Returns the public profile of a user:
 *   { displayName, avatarUrl, currentMoodId, activityLevel }
 *
 * Requirements: 9.6
 */
router.get(
  '/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const profile = await getPublicProfile(req.params.id);
      res.json(profile);
    } catch (err) {
      res.status(statusFrom(err)).json({
        error: { code: codeFrom(err), message: messageFrom(err) },
      });
    }
  }
);

/**
 * PATCH /users/me
 *
 * Update the authenticated user's displayName and/or currentMoodId.
 *
 * Validation:
 *   - displayName: 1–30 chars (400 if out of range)
 *   - currentMoodId: must exist in Mood collection (400 if unrecognised)
 *
 * Side effects on mood change:
 *   - Broadcasts pulse_board_update to all group conversations within 500ms
 *   - Emits presence_update with new mood
 *
 * Requirements: 9.3, 9.4, 9.5
 */
router.patch(
  '/me',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { displayName, currentMoodId } = req.body as {
      displayName?: unknown;
      currentMoodId?: unknown;
    };

    // Accept only string values for the fields we care about
    const input: { displayName?: string; currentMoodId?: string } = {};
    if (typeof displayName === 'string') input.displayName = displayName;
    if (typeof currentMoodId === 'string') input.currentMoodId = currentMoodId;

    try {
      const profile = await updateProfile(userId, input);
      res.json(profile);
    } catch (err) {
      res.status(statusFrom(err)).json({
        error: { code: codeFrom(err), message: messageFrom(err) },
      });
    }
  }
);

/**
 * POST /users/me/avatar
 *
 * Upload a profile picture (JPEG/PNG/GIF/WebP, ≤ 5 MB) to Cloudinary.
 * On success: stores the returned URL in the user's profile.
 * On Cloudinary failure: returns 502 without updating avatarUrl.
 *
 * Requirements: 9.1, 9.2
 */
router.post(
  '/me/avatar',
  authenticateToken,
  (req: Request, res: Response, next: (err?: unknown) => void) => {
    upload.single('avatar')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'File size must not exceed 5 MB.',
            },
          });
          return;
        }
        res.status(400).json({
          error: { code: 'UPLOAD_ERROR', message: err.message },
        });
        return;
      }
      if (err) {
        res.status(400).json({
          error: {
            code: 'INVALID_FILE_TYPE',
            message: (err as Error).message,
          },
        });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!;

    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'No file was uploaded. Include a file under the "avatar" field.',
        },
      });
      return;
    }

    try {
      const result = await uploadAvatar(
        userId,
        req.file.buffer,
        req.file.mimetype
      );
      res.json(result);
    } catch (err) {
      // Cloudinary failures should not update the DB — return 502
      const status = statusFrom(err) === 500 ? 502 : statusFrom(err);
      res.status(status).json({
        error: {
          code: codeFrom(err) === 'INTERNAL_ERROR' ? 'CLOUDINARY_ERROR' : codeFrom(err),
          message: messageFrom(err),
        },
      });
    }
  }
);

/**
 * POST /users/me/device-token
 *
 * Register or update an FCM or APNs device token.
 * Uses $addToSet to avoid duplicates in deviceTokens[].
 *
 * Requirements: 10.1
 */
router.post(
  '/me/device-token',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { token } = req.body as { token?: unknown };

    if (typeof token !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_DEVICE_TOKEN',
          message: 'token must be a non-empty string.',
        },
      });
      return;
    }

    try {
      await registerDeviceToken(userId, token);
      res.status(200).json({ message: 'Device token registered.' });
    } catch (err) {
      res.status(statusFrom(err)).json({
        error: { code: codeFrom(err), message: messageFrom(err) },
      });
    }
  }
);

export default router;
