import { Server as SocketIOServer } from 'socket.io';
export interface CapsuleUnlockPayload {
    messageId: string;
    conversationId: string;
}
/**
 * Capsule unlock scheduler — called by the cron job every 30 seconds.
 *
 * Queries for time-based capsule messages where `unlockAt <= now` and
 * `status === "locked"`, updates their status to `"unlocked"`, and emits
 * `capsule_unlock` via Socket.io within 2 seconds (Requirement 4.6).
 *
 * For offline recipients the event is written to `pendingEvents` and
 * delivered on reconnect (Requirement 4.10).
 *
 * Requirements: 4.6, 4.10
 *
 * @param io - The shared Socket.io server instance
 */
export declare function runCapsuleUnlockScheduler(io: SocketIOServer): Promise<void>;
/**
 * Handle a condition-met signal from the recipient.
 *
 * Validates that the caller is the recipient of the capsule message, updates
 * the capsule status to "unlocked", and emits `capsule_unlock` within 2
 * seconds (Requirement 4.9).
 *
 * Requirements: 4.8, 4.9, 4.10
 *
 * @param io        - The shared Socket.io server instance
 * @param messageId - The capsule message's MongoDB ObjectId string
 * @param callerId  - The authenticated user's MongoDB ObjectId string
 * @returns The updated message object
 * @throws An error with `statusCode` and `code` properties on validation failure
 */
export declare function handleConditionMet(io: SocketIOServer, messageId: string, callerId: string): Promise<Record<string, unknown>>;
/**
 * Drain and deliver all pending events for a user who has just connected.
 *
 * Fetches all `pendingEvents` for `recipientId` ordered by `createdAt`,
 * emits each event to the user's socket, then deletes the delivered records.
 *
 * Must complete within 5 seconds of reconnect (Requirement 7.4 / 4.10).
 *
 * Requirements: 4.10, 7.4
 *
 * @param io          - The shared Socket.io server instance
 * @param recipientId - The reconnecting user's MongoDB ObjectId string
 */
export declare function drainPendingEvents(io: SocketIOServer, recipientId: string): Promise<void>;
//# sourceMappingURL=capsuleService.d.ts.map