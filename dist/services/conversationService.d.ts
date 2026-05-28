import { IConversation } from '../models';
/**
 * Conversation Service
 *
 * Encapsulates all business logic for conversation CRUD and membership management.
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.8
 */
export interface CreateDirectConversationInput {
    type: 'direct';
    requesterId: string;
    otherUserId: string;
}
export interface CreateGroupConversationInput {
    type: 'group';
    requesterId: string;
    name: string;
    memberIds: string[];
}
export type CreateConversationInput = CreateDirectConversationInput | CreateGroupConversationInput;
export interface ConversationServiceError {
    code: string;
    message: string;
    status: number;
}
/**
 * Create a direct or group conversation.
 *
 * Direct: deduplicates — if a direct conversation between the two users already
 * exists, returns the existing record (201 is still appropriate for the caller
 * to decide; the route handler returns 200 for existing, 201 for new).
 *
 * Group: validates name (1–50 chars) and that at least 2 other members are
 * specified. Returns a descriptive 400 error on validation failure.
 *
 * Requirements: 8.2, 8.3, 8.8
 */
export declare function createConversation(input: CreateConversationInput): Promise<{
    conversation: IConversation;
    created: boolean;
}>;
/**
 * Return all conversations for a user, sorted by lastMessageAt descending.
 * Conversations with no messages yet (lastMessageAt undefined) appear last.
 *
 * Requirements: 8.6
 */
export declare function getUserConversations(userId: string): Promise<IConversation[]>;
/**
 * Add a member to a group conversation.
 * Only admins may perform this action (403 if not).
 * Emits `member_added` to the conversation Socket.io room within 500ms.
 *
 * Requirements: 8.4
 */
export declare function addMember(conversationId: string, requesterId: string, newMemberId: string): Promise<IConversation>;
/**
 * Remove the requesting user from a conversation (leave).
 *
 * If the leaving user is the last admin, the member with the earliest
 * `joinedAt` among remaining members is promoted to admin first.
 *
 * Requirements: 8.5
 */
export declare function leaveConversation(conversationId: string, userId: string): Promise<IConversation>;
//# sourceMappingURL=conversationService.d.ts.map