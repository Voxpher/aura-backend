import { Router, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { Conversation } from '../models';
import User from '../models/User';
import {
  createConversation,
  getUserConversations,
  addMember,
  leaveConversation,
} from '../services/conversationService';

const router = Router();

// ── Validation schemas ─────────────────────────────────────────────────────

const CreateConversationSchema = z.union([
  z.object({
    type: z.literal('direct'),
    memberIds: z.array(z.string()).min(1, 'memberIds is required for direct conversations.'),
  }),
  z.object({
    type: z.literal('group'),
    name: z.string().min(1, 'name is required for group conversations.'),
    memberIds: z.array(z.string()).min(2, 'A group requires at least 2 other members.'),
  }),
]);

const AddMemberSchema = z.object({
  userId: z.string().min(1, 'userId is required.'),
});

const NotificationPrefsSchema = z.object({
  enabled: z.boolean({
    required_error: 'enabled is required',
    invalid_type_error: 'enabled must be a boolean',
  }),
});

// Maps a service-thrown error ({code,message,status}) onto an HTTP response.
function handleServiceError(res: Response, err: unknown): void {
  const e = err as { code?: string; message?: string; status?: number };
  res.status(e.status ?? 500).json({
    error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unexpected error.' },
  });
}

// ── POST /conversations ────────────────────────────────────────────────────
// Create a direct or group conversation.
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = CreateConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map((e) => e.message).join('; ') },
    });
    return;
  }

  try {
    const requesterId = req.userId!;
    const result =
      parsed.data.type === 'direct'
        ? await createConversation({
            type: 'direct',
            requesterId,
            otherUserId: parsed.data.memberIds[0],
          })
        : await createConversation({
            type: 'group',
            requesterId,
            name: parsed.data.name,
            memberIds: parsed.data.memberIds,
          });

    res.status(result.created ? 201 : 200).json(result.conversation);
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ── GET /conversations ─────────────────────────────────────────────────────
// List all conversations for the authenticated user (sorted by lastMessageAt).
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversations = await getUserConversations(req.userId!);
    res.status(200).json(conversations);
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ── POST /conversations/:id/members ────────────────────────────────────────
// Add a member to a group conversation (admin only).
router.post('/:id/members', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = AddMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map((e) => e.message).join('; ') },
    });
    return;
  }
  try {
    const conversation = await addMember(req.params.id, req.userId!, parsed.data.userId);
    res.status(200).json(conversation);
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ── DELETE /conversations/:id/members/me ───────────────────────────────────
// Leave a conversation.
router.delete('/:id/members/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await leaveConversation(req.params.id, req.userId!);
    res.status(204).send();
  } catch (err) {
    handleServiceError(res, err);
  }
});

// ── PATCH /conversations/:id/notification-prefs ────────────────────────────
router.patch(
  '/:id/notification-prefs',
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const conversationId = req.params.id;
    const userId = req.userId!;

    if (!Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({
        error: { code: 'INVALID_CONVERSATION_ID', message: 'Invalid conversation ID.' },
      });
      return;
    }

    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
      res.status(404).json({
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' },
      });
      return;
    }

    const isMember = conversation.members.some((m) => m.userId.toString() === userId);
    if (!isMember) {
      res.status(403).json({
        error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this conversation.' },
      });
      return;
    }

    const parsed = NotificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors.map((e) => e.message).join('; ') },
      });
      return;
    }

    await User.findByIdAndUpdate(userId, {
      $set: { [`notificationPrefs.${conversationId}`]: parsed.data.enabled },
    });

    res.status(200).json({ enabled: parsed.data.enabled });
  }
);

export default router;
