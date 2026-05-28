import { Types } from 'mongoose';
import { Message, Mood, Conversation } from '../models';
import { IMessage } from '../models/Message';
import { getIO } from '../socket';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  moodId?: string;
  capsule?: {
    type: 'time' | 'condition';
    unlockAt?: Date;
    conditionId?: string;
  };
}

export interface PaginatedMessagesInput {
  conversationId: string;
  limit?: number;
  before?: string; // messageId cursor
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip `content` from a message object when the capsule is still locked.
 * Returns a plain JS object so callers can safely mutate it.
 * Requirements: 4.5, 4.11
 */
export function stripLockedCapsuleContent(
  message: IMessage
): Record<string, unknown> {
  const obj = message.toObject ? message.toObject() : { ...message };
  if (
    obj.capsule &&
    (obj.capsule as { enabled?: boolean; status?: string }).enabled &&
    (obj.capsule as { status?: string }).status === 'locked'
  ) {
    delete (obj as Record<string, unknown>).content;
  }
  return obj as Record<string, unknown>;
}

// ── Service functions ──────────────────────────────────────────────────────

/**
 * Verify that `userId` is a member of `conversationId`.
 * Returns the conversation document or throws with an appropriate HTTP-style
 * error object that the route handler can inspect.
 */
export async function assertConversationMember(
  conversationId: string,
  userId: string
): Promise<InstanceType<typeof Conversation>> {
  if (!Types.ObjectId.isValid(conversationId)) {
    const err = new Error('Invalid conversation ID.') as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 400;
    err.code = 'INVALID_CONVERSATION_ID';
    throw err;
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const err = new Error('Conversation not found.') as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 404;
    err.code = 'CONVERSATION_NOT_FOUND';
    throw err;
  }

  const isMember = conversation.members.some(
    (m) => m.userId.toString() === userId
  );
  if (!isMember) {
    const err = new Error(
      'You are not a member of this conversation.'
    ) as Error & { statusCode: number; code: string };
    err.statusCode = 403;
    err.code = 'NOT_A_MEMBER';
    throw err;
  }

  return conversation;
}

/**
 * Send a message to a conversation.
 *
 * - Defaults `moodId` to `"neutral"` when absent (Requirement 2.4).
 * - Validates that the moodId exists in the Mood collection (Requirement 2.9).
 * - Persists the message; if the DB write fails the error propagates — never
 *   silently dropped (Requirement 2.9).
 * - Emits `new_message` to the conversation's Socket.io room after a
 *   successful write (Requirement 7.1).
 * - Returns the persisted message object (content stripped if capsule locked).
 *
 * Requirements: 2.3, 2.4, 2.8, 2.9, 7.1
 */
export async function sendMessage(
  input: SendMessageInput
): Promise<Record<string, unknown>> {
  const { conversationId, senderId, content, capsule } = input;
  const moodId = input.moodId ?? 'neutral';

  // Validate moodId exists (Requirement 2.9 — never silently drop mood)
  const mood = await Mood.findById(moodId);
  if (!mood) {
    const err = new Error(
      `Mood identifier "${moodId}" is not recognised.`
    ) as Error & { statusCode: number; code: string };
    err.statusCode = 400;
    err.code = 'INVALID_MOOD_ID';
    throw err;
  }

  // Build capsule sub-document when provided
  let capsuleDoc: IMessage['capsule'] | undefined;
  if (capsule) {
    if (capsule.type === 'time') {
      if (!capsule.unlockAt) {
        const err = new Error(
          'unlockAt is required for time-based capsule messages.'
        ) as Error & { statusCode: number; code: string };
        err.statusCode = 400;
        err.code = 'MISSING_UNLOCK_AT';
        throw err;
      }
      const minUnlock = new Date(Date.now() + 60_000);
      if (capsule.unlockAt < minUnlock) {
        const err = new Error(
          'unlockAt must be at least 1 minute in the future.'
        ) as Error & { statusCode: number; code: string };
        err.statusCode = 400;
        err.code = 'INVALID_UNLOCK_AT';
        throw err;
      }
      capsuleDoc = {
        enabled: true,
        type: 'time',
        unlockAt: capsule.unlockAt,
        status: 'locked',
      };
    } else if (capsule.type === 'condition') {
      if (!capsule.conditionId) {
        const err = new Error(
          'conditionId is required for condition-based capsule messages.'
        ) as Error & { statusCode: number; code: string };
        err.statusCode = 400;
        err.code = 'MISSING_CONDITION_ID';
        throw err;
      }
      capsuleDoc = {
        enabled: true,
        type: 'condition',
        conditionId: capsule.conditionId,
        status: 'locked',
      };
    }
  }

  // Persist — any DB error propagates to the caller (Requirement 2.9)
  const message = await Message.create({
    conversationId: new Types.ObjectId(conversationId),
    senderId: new Types.ObjectId(senderId),
    content,
    moodId,
    depth: 0,
    ...(capsuleDoc ? { capsule: capsuleDoc } : {}),
  });

  // Update conversation's lastMessageAt for sort order (Requirement 8.6)
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessageAt: message.createdAt,
  });

  // Emit new_message to the conversation room (Requirement 7.1)
  try {
    const io = getIO();
    const payload = stripLockedCapsuleContent(message);
    io.to(conversationId).emit('new_message', { message: payload });
  } catch {
    // Socket.io not yet initialised in test environments — log and continue
    console.warn(
      '[messageService] Socket.io not available; new_message event not emitted.'
    );
  }

  return stripLockedCapsuleContent(message);
}

/**
 * Return paginated message history for a conversation.
 *
 * Uses the `{ conversationId: 1, createdAt: -1 }` index.
 * Supports `limit` (default 50, max 100) and `before` cursor (a messageId).
 *
 * Requirements: 2.1
 */
export async function getMessages(
  input: PaginatedMessagesInput
): Promise<Record<string, unknown>[]> {
  const { conversationId } = input;
  const limit = Math.min(input.limit ?? 50, 100);

  // Build the query filter
  const filter: Record<string, unknown> = {
    conversationId: new Types.ObjectId(conversationId),
  };

  if (input.before) {
    if (!Types.ObjectId.isValid(input.before)) {
      const err = new Error('Invalid cursor (before) value.') as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 400;
      err.code = 'INVALID_CURSOR';
      throw err;
    }
    // Fetch the createdAt of the cursor message so we can paginate by time
    const cursorMessage = await Message.findById(input.before).select(
      'createdAt'
    );
    if (cursorMessage) {
      filter.createdAt = { $lt: cursorMessage.createdAt };
    }
  }

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Strip content from locked capsule messages (Requirement 4.11)
  return messages.map((msg) => {
    const m = { ...msg } as Record<string, unknown>;
    const capsule = m.capsule as
      | { enabled?: boolean; status?: string }
      | undefined;
    if (capsule?.enabled && capsule.status === 'locked') {
      delete m.content;
    }
    return m;
  });
}
