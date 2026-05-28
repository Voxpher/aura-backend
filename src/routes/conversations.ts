import { Router, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { Conversation } from '../models';
import User from '../models/User';

const router = Router();

// ── Validation schemas ─────────────────────────────────────────────────────

const NotificationPrefsSchema = z.object({
  enabled: z.boolean({
    required_error: 'enabled is required',
    invalid_type_error: 'enabled must be a boolean',
  }),
});

// ── PATCH /conversations/:id/notification-prefs ────────────────────────────

/**
 * Toggle push notifications for a specific conversation.
 *
 * - Requires authentication.
 * - Caller must be a member of the conversation.
 * - Accepts `{ enabled: boolean }` in the request body.
 * - Updates `user.notificationPrefs[conversationId]` in MongoDB.
 * - New conversations default to `true` (no entry in map = enabled).
 *
 * Requirements: 10.5, 10.6
 */
router.patch(
  '/:id/notification-prefs',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const conversationId = req.params.id;
    const userId = req.userId!;

    // Validate conversation ID format
    if (!Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_CONVERSATION_ID',
          message: 'Invalid conversation ID.',
        },
      });
      return;
    }

    // Verify the conversation exists and the caller is a member
    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
      res.status(404).json({
        error: {
          code: 'CONVERSATION_NOT_FOUND',
          message: 'Conversation not found.',
        },
      });
      return;
    }

    const isMember = conversation.members.some(
      (m) => m.userId.toString() === userId
    );
    if (!isMember) {
      res.status(403).json({
        error: {
          code: 'NOT_A_MEMBER',
          message: 'You are not a member of this conversation.',
        },
      });
      return;
    }

    // Validate request body
    const parsed = NotificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map((e) => e.message).join('; '),
        },
      });
      return;
    }

    const { enabled } = parsed.data;

    // Update the per-conversation notification preference using dot-notation
    // so only the targeted key in the notificationPrefs map is modified.
    await User.findByIdAndUpdate(userId, {
      $set: { [`notificationPrefs.${conversationId}`]: enabled },
    });

    res.status(200).json({ enabled });
  }
);

export default router;
