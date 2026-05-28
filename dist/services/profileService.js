"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDeviceToken = exports.searchUsers = exports.uploadAvatar = exports.updateProfile = exports.getPublicProfile = exports.computeActivityLevel = void 0;
const mongoose_1 = require("mongoose");
const cloudinary_1 = require("cloudinary");
const User_1 = __importDefault(require("../models/User"));
const Mood_1 = __importDefault(require("../models/Mood"));
const Conversation_1 = __importDefault(require("../models/Conversation"));
const pulseEngine_1 = require("./pulseEngine");
const socket_1 = require("../socket");
/**
 * Computes the activity level for a user based on their last activity timestamp.
 *
 * Thresholds (Requirement 6.2):
 *   Active  — lastActivityAt ≤ 2 minutes ago
 *   Recent  — lastActivityAt ≤ 15 minutes ago
 *   Idle    — lastActivityAt ≤ 60 minutes ago
 *   Away    — lastActivityAt > 60 minutes ago (or no timestamp)
 */
function computeActivityLevel(lastActivityAt) {
    if (!lastActivityAt)
        return 'away';
    const elapsedMs = Date.now() - lastActivityAt.getTime();
    const minutes = elapsedMs / 60000;
    if (minutes <= 2)
        return 'active';
    if (minutes <= 15)
        return 'recent';
    if (minutes <= 60)
        return 'idle';
    return 'away';
}
exports.computeActivityLevel = computeActivityLevel;
/**
 * Fetches the public profile for a user by ID.
 *
 * Returns: displayName, avatarUrl, currentMoodId, activityLevel
 * Requirements: 9.6
 */
async function getPublicProfile(userId) {
    if (!mongoose_1.Types.ObjectId.isValid(userId)) {
        const err = new Error('Invalid user ID.');
        err.statusCode = 400;
        err.code = 'INVALID_USER_ID';
        throw err;
    }
    const user = await User_1.default.findById(userId)
        .select('displayName avatarUrl currentMoodId lastActivityAt')
        .lean()
        .exec();
    if (!user) {
        const err = new Error('User not found.');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }
    return {
        _id: user._id.toString(),
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        currentMoodId: user.currentMoodId,
        activityLevel: computeActivityLevel(user.lastActivityAt),
    };
}
exports.getPublicProfile = getPublicProfile;
/**
 * Updates the authenticated user's displayName and/or currentMoodId.
 *
 * Validation:
 *   - displayName must be 1–30 characters (Requirement 9.5)
 *   - currentMoodId must exist in the Mood collection (Requirement 9.3)
 *
 * Side effects on mood change:
 *   - Broadcasts pulse_board_update to all group conversations the user belongs to (Requirement 3.7)
 *   - Emits presence_update with the new mood (Requirement 9.4)
 *
 * Requirements: 9.3, 9.4, 9.5
 */
async function updateProfile(userId, input) {
    const { displayName, currentMoodId } = input;
    // Validate displayName length (Requirement 9.5)
    if (displayName !== undefined) {
        if (displayName.length < 1 || displayName.length > 30) {
            const err = new Error('displayName must be between 1 and 30 characters.');
            err.statusCode = 400;
            err.code = 'INVALID_DISPLAY_NAME';
            throw err;
        }
    }
    // Validate currentMoodId exists in Mood collection (Requirement 9.3)
    if (currentMoodId !== undefined) {
        const mood = await Mood_1.default.findById(currentMoodId).lean().exec();
        if (!mood) {
            const err = new Error(`Mood identifier "${currentMoodId}" is not recognised.`);
            err.statusCode = 400;
            err.code = 'INVALID_MOOD_ID';
            throw err;
        }
    }
    // Build update object — only include provided fields
    const updateFields = {};
    if (displayName !== undefined)
        updateFields.displayName = displayName;
    if (currentMoodId !== undefined)
        updateFields.currentMoodId = currentMoodId;
    if (Object.keys(updateFields).length === 0) {
        // Nothing to update — return current profile
        return getPublicProfile(userId);
    }
    const updatedUser = await User_1.default.findByIdAndUpdate(userId, { $set: updateFields }, { new: true, runValidators: true })
        .select('displayName avatarUrl currentMoodId lastActivityAt')
        .lean()
        .exec();
    if (!updatedUser) {
        const err = new Error('User not found.');
        err.statusCode = 404;
        err.code = 'USER_NOT_FOUND';
        throw err;
    }
    // Broadcast mood change side effects when currentMoodId was updated
    if (currentMoodId !== undefined) {
        try {
            const io = (0, socket_1.getIO)();
            // Emit presence_update to all connected clients (Requirement 9.4)
            io.emit('presence_update', { userId, activityLevel: computeActivityLevel(updatedUser.lastActivityAt) });
            // Broadcast pulse_board_update for every group conversation this user belongs to (Requirement 3.7)
            const groupConversations = await Conversation_1.default.find({
                'members.userId': new mongoose_1.Types.ObjectId(userId),
                type: 'group',
            })
                .select('_id')
                .lean()
                .exec();
            // Fire-and-forget pulse updates — do not block the response
            for (const conv of groupConversations) {
                (0, pulseEngine_1.triggerPulseUpdate)(conv._id.toString(), io).catch((err) => {
                    console.warn(`[profileService] Failed to trigger pulse update for group ${conv._id}:`, err);
                });
            }
        }
        catch {
            // Socket.io not yet initialised (e.g. test environment) — log and continue
            console.warn('[profileService] Socket.io not available; mood broadcast skipped.');
        }
    }
    return {
        _id: updatedUser._id.toString(),
        displayName: updatedUser.displayName,
        avatarUrl: updatedUser.avatarUrl,
        currentMoodId: updatedUser.currentMoodId,
        activityLevel: computeActivityLevel(updatedUser.lastActivityAt),
    };
}
exports.updateProfile = updateProfile;
// ── Avatar upload ──────────────────────────────────────────────────────────
/**
 * Uploads an avatar image buffer to Cloudinary and stores the returned URL
 * in the user's profile record.
 *
 * - Accepted formats: JPEG, PNG, GIF, WebP (validated by multer before this call)
 * - Max size: 5 MB (validated by multer before this call)
 * - On Cloudinary failure: throws without updating avatarUrl (Requirement 9.2)
 *
 * Requirements: 9.1, 9.2
 */
async function uploadAvatar(userId, fileBuffer, mimetype) {
    // Upload to Cloudinary using a stream from the buffer
    const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder: 'aura/avatars',
            resource_type: 'image',
            // Derive format from mimetype for Cloudinary
            format: mimetypeToFormat(mimetype),
        }, (error, result) => {
            if (error || !result) {
                reject(error ?? new Error('Cloudinary upload returned no result.'));
            }
            else {
                resolve(result);
            }
        });
        uploadStream.end(fileBuffer);
    });
    // Only update DB after a successful Cloudinary upload (Requirement 9.2)
    await User_1.default.findByIdAndUpdate(userId, {
        $set: { avatarUrl: uploadResult.secure_url },
    });
    return { avatarUrl: uploadResult.secure_url };
}
exports.uploadAvatar = uploadAvatar;
/**
 * Maps a MIME type to the Cloudinary format string.
 */
function mimetypeToFormat(mimetype) {
    const map = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
    };
    return map[mimetype] ?? 'jpg';
}
/**
 * Searches for users by username prefix (case-insensitive).
 *
 * - Requires q.length >= 1
 * - Returns up to 20 matching profiles (Requirement 8.1)
 * - Uses the `{ username: 1 }` index for fast prefix matching
 *
 * Requirements: 8.1
 */
async function searchUsers(q) {
    if (!q || q.length < 1) {
        const err = new Error('Search query must be at least 1 character.');
        err.statusCode = 400;
        err.code = 'QUERY_TOO_SHORT';
        throw err;
    }
    // Escape special regex characters in the query to prevent injection
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User_1.default.find({
        username: { $regex: `^${escapedQ}`, $options: 'i' },
    })
        .select('username displayName avatarUrl currentMoodId lastActivityAt')
        .limit(20)
        .lean()
        .exec();
    return users.map((u) => ({
        _id: u._id.toString(),
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        currentMoodId: u.currentMoodId,
        activityLevel: computeActivityLevel(u.lastActivityAt),
    }));
}
exports.searchUsers = searchUsers;
// ── Device token registration ──────────────────────────────────────────────
/**
 * Registers or updates an FCM or APNs device token for the authenticated user.
 *
 * Uses `$addToSet` to avoid duplicates in the `deviceTokens[]` array.
 *
 * Requirements: 10.1
 */
async function registerDeviceToken(userId, token) {
    if (!token || token.trim().length === 0) {
        const err = new Error('Device token must not be empty.');
        err.statusCode = 400;
        err.code = 'INVALID_DEVICE_TOKEN';
        throw err;
    }
    await User_1.default.findByIdAndUpdate(userId, {
        $addToSet: { deviceTokens: token.trim() },
    });
}
exports.registerDeviceToken = registerDeviceToken;
//# sourceMappingURL=profileService.js.map