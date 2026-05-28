"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPresenceLevelCheck = exports.computeActivityLevel = void 0;
const User_1 = __importDefault(require("../models/User"));
/** Thresholds in milliseconds (Requirement 6.2) */
const ACTIVE_MS = 2 * 60 * 1000; // ≤ 2 minutes
const RECENT_MS = 15 * 60 * 1000; // ≤ 15 minutes
const IDLE_MS = 60 * 60 * 1000; // ≤ 60 minutes
// > 60 minutes → Away
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
function computeActivityLevel(lastActivityAt) {
    const elapsed = Date.now() - lastActivityAt.getTime();
    if (elapsed <= ACTIVE_MS)
        return 'active';
    if (elapsed <= RECENT_MS)
        return 'recent';
    if (elapsed <= IDLE_MS)
        return 'idle';
    return 'away';
}
exports.computeActivityLevel = computeActivityLevel;
/**
 * In-memory map of the last broadcast activity level per userId.
 * Used by the background job to detect level transitions.
 */
const lastBroadcastLevel = new Map();
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
async function runPresenceLevelCheck(io) {
    try {
        // Fetch all users that have ever recorded activity
        const users = await User_1.default.find({ lastActivityAt: { $exists: true, $ne: null } }, { _id: 1, lastActivityAt: 1 })
            .lean()
            .exec();
        for (const user of users) {
            const userId = user._id.toString();
            const lastActivityAt = user.lastActivityAt;
            const currentLevel = computeActivityLevel(lastActivityAt);
            const previousLevel = lastBroadcastLevel.get(userId);
            if (currentLevel !== previousLevel) {
                // Level has changed — broadcast to all rooms containing this user
                lastBroadcastLevel.set(userId, currentLevel);
                // Emit to the user's own room (userId is used as a personal room)
                // and to any conversation rooms the user has joined.
                // Socket.io rooms are joined by the client on connection; we emit
                // to the userId room so any socket subscribed to that user receives it.
                io.to(userId).emit('presence_update', {
                    userId,
                    activityLevel: currentLevel,
                });
            }
        }
    }
    catch (err) {
        console.error('[PresenceService] Error during level check:', err);
    }
}
exports.runPresenceLevelCheck = runPresenceLevelCheck;
//# sourceMappingURL=presenceService.js.map