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
export declare function createReply(input: CreateReplyInput): Promise<Record<string, unknown>>;
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
export declare function getThread(rootMessageId: string): Promise<ThreadNode>;
//# sourceMappingURL=echoThreadService.d.ts.map