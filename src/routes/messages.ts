import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  sendMessage,
  getMessages,
  assertConversationMember,
} from '../services/messageService';
import { createReply, getThread } from '../services/echoThreadService';
import { handleConditionMet } from '../services/capsuleService';
import { getIO } from '../socket';

/**
 * Messages router.
 *
 * This router is mounted in two places:
 *   1. `/conversations/:conversationId/messages` — for sending and listing
 *      messages within a conversation (mergeParams: true so :conversationId
 *      is accessible).
 *   2. `/messages` — for Echo Thread operations that reference a message
 *      directly by its own ID.
 *
 * Requirements: 2.3, 2.4, 2.8, 2.9, 5.3, 5.6, 5.8, 7.1
 */
const router = Router({ mergeParams: true });

// ── Validation schemas ─────────────────────────────────────────────────────

const CapsuleSchema = z.union([
  z.object({
    type: z.literal('time'),
    unlockAt: z.string().datetime({ message: 'unlockAt must be an ISO 8601 datetime string.' }),
  }),
  z.object({
    type: z.literal('condition'),
    conditionId: z.string().min(1, 'conditionId is required for condition-based capsules.'),
  }),
]);

const SendMessageSchema = z.object({
  content: z.string().min(1, 'content is required.'),
  moodId: z.string().optional(),
  capsule: CapsuleSchema.optional(),
});

// ── POST /conversations/:conversationId/messages ───────────────────────────
/**
 * Send a message to a conversation.
 *
 * - Auth required; caller must be a conversation member.
 * - Defaults moodId to "neutral" when absent (Requirement 2.4).
 * - Validates moodId exists in Mood collection (Requirement 2.9).
 * - Emits `new_message` Socket.io event to the conversation room (Req 7.1).
 *
 * Requirements: 2.3, 2.4, 2.8, 2.9, 7.1
 */
router.post(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = req.params.conversationId ?? req.params.id;
      const senderId = req.userId!;

      // Verify membership
      await assertConversationMember(conversationId, senderId);

      // Validate body
      const parsed = SendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join('; '),
          },
        });
        return;
      }

      const { content, moodId, capsule } = parsed.data;

      // Build capsule input if provided
      let capsuleInput:
        | { type: 'time'; unlockAt: Date }
        | { type: 'condition'; conditionId: string }
        | undefined;

      if (capsule) {
        if (capsule.type === 'time') {
          capsuleInput = { type: 'time', unlockAt: new Date(capsule.unlockAt) };
        } else {
          capsuleInput = { type: 'condition', conditionId: capsule.conditionId };
        }
      }

      const message = await sendMessage({
        conversationId,
        senderId,
        content,
        moodId,
        capsule: capsuleInput,
      });

      res.status(201).json(message);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number; code?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({
          error: { code: e.code ?? 'ERROR', message: e.message },
        });
        return;
      }
      next(err);
    }
  }
);

// ── GET /conversations/:conversationId/messages ────────────────────────────
/**
 * Paginated message history for a conversation.
 *
 * Query params:
 *   - limit  (number, default 50, max 100)
 *   - before (messageId cursor for keyset pagination)
 *
 * Requirements: 2.1
 */
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = req.params.conversationId ?? req.params.id;
      const userId = req.userId!;

      // Verify membership
      await assertConversationMember(conversationId, userId);

      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const before = req.query.before as string | undefined;

      const messages = await getMessages({ conversationId, limit, before });
      res.status(200).json(messages);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number; code?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({
          error: { code: e.code ?? 'ERROR', message: e.message },
        });
        return;
      }
      next(err);
    }
  }
);

// ── POST /messages/:id/replies ─────────────────────────────────────────────
/**
 * Add a reply to an Echo Thread.
 *
 * - Auth required.
 * - Validates the parent message exists (404 if not).
 * - Computes depth = parent.depth + 1; rejects with 400 if depth > 5
 *   (Requirement 5.6).
 * - Stores the reply with parentMessageId and depth (Requirement 5.3).
 * - Emits `new_reply` Socket.io event to the conversation room within 500 ms
 *   (Requirement 5.8).
 *
 * Requirements: 5.3, 5.6, 5.8, 5.11
 */
router.post(
  '/:id/replies',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parentMessageId = req.params.id;
      const senderId = req.userId!;
      const { content, moodId } = req.body as {
        content?: string;
        moodId?: string;
      };

      if (!content || typeof content !== 'string' || content.trim() === '') {
        res.status(400).json({
          error: {
            code: 'MISSING_CONTENT',
            message: 'Reply content is required.',
          },
        });
        return;
      }

      const reply = await createReply({
        parentMessageId,
        senderId,
        content: content.trim(),
        moodId,
      });

      res.status(201).json(reply);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number; code?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({
          error: { code: e.code ?? 'ERROR', message: e.message },
        });
        return;
      }
      next(err);
    }
  }
);

// ── GET /messages/:id/thread ───────────────────────────────────────────────
/**
 * Fetch the full Echo Thread for a message.
 *
 * Returns a nested JSON tree of replies up to depth 5, using the
 * `{ parentMessageId: 1 }` index for efficient traversal.
 *
 * Requirements: 5.3, 5.6
 */
router.get(
  '/:id/thread',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rootMessageId = req.params.id;
      const thread = await getThread(rootMessageId);
      res.status(200).json(thread);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number; code?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({
          error: { code: e.code ?? 'ERROR', message: e.message },
        });
        return;
      }
      next(err);
    }
  }
);

// ── POST /messages/:id/condition-met ──────────────────────────────────────
/**
 * Signal that a condition-based capsule's condition has been met.
 *
 * - Auth required; caller must be the recipient (non-sender) of the capsule.
 * - Updates capsule status to "unlocked".
 * - Emits `capsule_unlock` via Socket.io within 2 seconds (Requirement 4.9).
 * - For offline participants, writes to `pendingEvents` for delivery on
 *   reconnect (Requirement 4.10).
 *
 * Requirements: 4.8, 4.9, 4.10
 */
router.post(
  '/:id/condition-met',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const messageId = req.params.id;
      const callerId = req.userId!;

      let io;
      try {
        io = getIO();
      } catch {
        res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Real-time service is not available.',
          },
        });
        return;
      }

      const message = await handleConditionMet(io, messageId, callerId);
      res.status(200).json(message);
    } catch (err: unknown) {
      const e = err as Error & { statusCode?: number; code?: string };
      if (e.statusCode) {
        res.status(e.statusCode).json({
          error: { code: e.code ?? 'ERROR', message: e.message },
        });
        return;
      }
      next(err);
    }
  }
);

export default router;
