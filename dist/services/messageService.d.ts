import { Conversation } from '../models';
import { IMessage } from '../models/Message';
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
    before?: string;
}
/**
 * Strip `content` from a message object when the capsule is still locked.
 * Returns a plain JS object so callers can safely mutate it.
 * Requirements: 4.5, 4.11
 */
export declare function stripLockedCapsuleContent(message: IMessage): Record<string, unknown>;
/**
 * Verify that `userId` is a member of `conversationId`.
 * Returns the conversation document or throws with an appropriate HTTP-style
 * error object that the route handler can inspect.
 */
export declare function assertConversationMember(conversationId: string, userId: string): Promise<InstanceType<typeof Conversation>>;
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
export declare function sendMessage(input: SendMessageInput): Promise<Record<string, unknown>>;
/**
 * Return paginated message history for a conversation.
 *
 * Uses the `{ conversationId: 1, createdAt: -1 }` index.
 * Supports `limit` (default 50, max 100) and `before` cursor (a messageId).
 *
 * Requirements: 2.1
 */
export declare function getMessages(input: PaginatedMessagesInput): Promise<Record<string, unknown>[]>;
//# sourceMappingURL=messageService.d.ts.map