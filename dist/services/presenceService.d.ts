import { Server as SocketIOServer } from 'socket.io';
/**
 * The four activity levels defined by Requirement 6.2.
 */
export type ActivityLevel = 'active' | 'recent' | 'idle' | 'away';
/**
 * Pure function that maps a `lastActivityAt` timestamp to an ActivityLevel.
 *
 * Thresholds (Requirement 6.2):
 *   Active  — elapsed ≤ 2 minutes
 *   Recent  — elapsed ≤ 15 minutes
 *   Idle    — elapsed ≤ 60 minutes
 *   Away    — elapsed > 60 minutes
 *
 * @param lastActivityAt - The timestamp of the user's last recorded activity
 * @returns The corresponding ActivityLevel string
 */
export declare function computeActivityLevel(lastActivityAt: Date): ActivityLevel;
/**
 * Background job: runs every 30 seconds.
 *
 * For every user who has a `lastActivityAt` timestamp, compute their current
 * activity level. If the level has changed since the last broadcast, emit a
 * `presence_update` event to all Socket.io rooms that contain that user.
 *
 * The job must complete its emit within 2 seconds of detecting a transition
 * (Requirement 6.4). Since the emit is synchronous (in-process), this is
 * satisfied as long as the DB query completes in time.
 *
 * Requirements: 6.3, 6.4
 *
 * @param io - The shared Socket.io server instance
 */
export declare function runPresenceLevelCheck(io: SocketIOServer): Promise<void>;
//# sourceMappingURL=presenceService.d.ts.map