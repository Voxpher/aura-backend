import { Types } from 'mongoose';
import { Message } from '../models';
import { IMessage } from '../models/Message';
import { getIO } from '../socket';
import { stripLockedCapsuleContent } from './messageService';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateReplyInput {
  parentMessageId: string;
  senderId: string;
  content: string;
  moodId?: string;
}

/**
 * A node in the nested Echo Thread tree returned by `GET /messages/:id/thread`.
 * Requirements: 5.3, 5.6
 */
export interface ThreadNode {
  message: Record<string, unknown>;
  replies: ThreadNode[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a typed service error with an HTTP status code and error code.
 */
function makeError(
  message: string,
  statusCode: number,
  code: string
): Error & { statusCode: number; code: string } {
  const err = new Error(message) as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

// ── Service functions ──────────────────────────────────────────────────────

/**
 * Create a reply within an Echo Thread.
 *
 * - Validates that the parent message exists (404 if not).
 * - Computes `depth = parent.depth + 1`.
 * - Rejects with 400 if `depth > 5` (Requirement 5.6).
 * - Persists the reply with `parentMessageId` and `depth` (Requirement 5.3).
 * - Emits `new_reply` to the conversation's Socket.io room within 500 ms
 *   (Requirement 5.8).
 *
 * Requirements: 5.3, 5.6, 5.8, 5.11
 */
export async function createReply(
  input: CreateReplyInput
): Promise<Record<string, unknown>> {
  const { parentMessageId, senderId, content } = input;
  const moodId = input.moodId ?? 'neutral';

  // Validate parent message ID format
  if (!Types.ObjectId.isValid(parentMessageId)) {
    throw makeError('Invalid parent message ID.', 400, 'INVALID_MESSAGE_ID');
  }

  // Fetch parent message — must exist
  const parent = await Message.findById(parentMessageId);
  if (!parent) {
    throw makeError('Parent message not found.', 404, 'MESSAGE_NOT_FOUND');
  }

  // Enforce max depth of 5 (Requirement 5.6)
  const depth = parent.depth + 1;
  if (depth > 5) {
    throw makeError(
      'Maximum Echo Thread depth of 5 has been reached.',
      400,
      'MAX_DEPTH_EXCEEDED'
    );
  }

  // Persist the reply (Requirement 5.3)
  const reply = await Message.create({
    conversationId: parent.conversationId,
    senderId: new Types.ObjectId(senderId),
    content,
    moodId,
    parentMessageId: parent._id,
    depth,
  });

  // Emit new_reply to the conversation room within 500 ms (Requirement 5.8)
  try {
    const io = getIO();
    const payload = stripLockedCapsuleContent(reply);
    io.to(parent.conversationId.toString()).emit('new_reply', {
      reply: payload,
      parentId: parentMessageId,
    });
  } catch {
    // Socket.io not yet initialised in test environments — log and continue
    console.warn(
      '[echoThreadService] Socket.io not available; new_reply event not emitted.'
    );
  }

  return stripLockedCapsuleContent(reply);
}

/**
 * Fetch the full Echo Thread for a root message and return it as a nested
 * tree structure up to depth 5.
 *
 * Strategy:
 *  1. Validate the root message exists.
 *  2. Collect all descendants by iteratively querying the
 *     `{ parentMessageId: 1 }` index level by level (BFS).
 *  3. Assemble the flat list into a nested tree.
 *
 * Requirements: 5.3, 5.6
 */
export async function getThread(rootMessageId: string): Promise<ThreadNode> {
  if (!Types.ObjectId.isValid(rootMessageId)) {
    throw makeError('Invalid message ID.', 400, 'INVALID_MESSAGE_ID');
  }

  const root = await Message.findById(rootMessageId).lean();
  if (!root) {
    throw makeError('Message not found.', 404, 'MESSAGE_NOT_FOUND');
  }

  // BFS: collect all descendants using the parentMessageId index
  // We stop at depth 5 as per Requirement 5.6
  const allMessages: IMessage[] = [root as unknown as IMessage];
  let currentLevelIds: Types.ObjectId[] = [
    root._id as unknown as Types.ObjectId,
  ];

  while (currentLevelIds.length > 0) {
    const children = await Message.find({
      parentMessageId: { $in: currentLevelIds },
    }).lean();

    if (children.length === 0) break;

    // Filter to depth ≤ 5 (defensive — schema enforces this too)
    const validChildren = children.filter((c) => c.depth <= 5);
    allMessages.push(...(validChildren as unknown as IMessage[]));
    currentLevelIds = validChildren.map(
      (c) => c._id as unknown as Types.ObjectId
    );
  }

  // Build a map from id → ThreadNode for O(n) tree assembly
  const nodeMap = new Map<string, ThreadNode>();
  for (const msg of allMessages) {
    const id = (msg._id as Types.ObjectId).toString();
    nodeMap.set(id, {
      message: stripLockedCapsuleContent(msg as unknown as IMessage),
      replies: [],
    });
  }

  // Wire up parent → child relationships
  for (const msg of allMessages) {
    const parentId = (
      msg as unknown as { parentMessageId?: Types.ObjectId }
    ).parentMessageId?.toString();
    if (parentId && nodeMap.has(parentId)) {
      const childId = (msg._id as Types.ObjectId).toString();
      const childNode = nodeMap.get(childId)!;
      nodeMap.get(parentId)!.replies.push(childNode);
    }
  }

  // Return the root node
  const rootNode = nodeMap.get(
    (root._id as unknown as Types.ObjectId).toString()
  );
  if (!rootNode) {
    throw makeError('Failed to build thread tree.', 500, 'INTERNAL_ERROR');
  }

  return rootNode;
}
