import { Types } from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import User from '../models/User';
import Mood from '../models/Mood';
import Conversation from '../models/Conversation';
import { triggerPulseUpdate } from './pulseEngine';
import { getIO } from '../socket';

// ── Activity level ─────────────────────────────────────────────────────────

export type ActivityLevel = 'active' | 'recent' | 'idle' | 'away';

/**
 * Computes the activity level for a user based on their last activity timestamp.
 *
 * Thresholds (Requirement 6.2):
 *   Active  — lastActivityAt ≤ 2 minutes ago
 *   Recent  — lastActivityAt ≤ 15 minutes ago
 *   Idle    — lastActivityAt ≤ 60 minutes ago
 *   Away    — lastActivityAt > 60 minutes ago (or no timestamp)
 */
export function computeActivityLevel(lastActivityAt?: Date): ActivityLevel {
  if (!lastActivityAt) return 'away';

  const elapsedMs = Date.now() - lastActivityAt.getTime();
  const minutes = elapsedMs / 60_000;

  if (minutes <= 2) return 'active';
  if (minutes <= 15) return 'recent';
  if (minutes <= 60) return 'idle';
  return 'away';
}

// ── Public profile ─────────────────────────────────────────────────────────

export interface PublicProfile {
  _id: string;
  displayName: string;
  avatarUrl?: string;
  currentMoodId?: string;
  activityLevel: ActivityLevel;
}

/**
 * Fetches the public profile for a user by ID.
 *
 * Returns: displayName, avatarUrl, currentMoodId, activityLevel
 * Requirements: 9.6
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile> {
  if (!Types.ObjectId.isValid(userId)) {
    const err = new Error('Invalid user ID.') as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 400;
    err.code = 'INVALID_USER_ID';
    throw err;
  }

  const user = await User.findById(userId)
    .select('displayName avatarUrl currentMoodId lastActivityAt')
    .lean()
    .exec();

  if (!user) {
    const err = new Error('User not found.') as Error & {
      statusCode: number;
      code: string;
    };
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

// ── Update profile (displayName / currentMoodId) ───────────────────────────

export interface UpdateProfileInput {
  displayName?: string;
  currentMoodId?: string;
}

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
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<PublicProfile> {
  const { displayName, currentMoodId } = input;

  // Validate displayName length (Requirement 9.5)
  if (displayName !== undefined) {
    if (displayName.length < 1 || displayName.length > 30) {
      const err = new Error(
        'displayName must be between 1 and 30 characters.'
      ) as Error & { statusCode: number; code: string };
      err.statusCode = 400;
      err.code = 'INVALID_DISPLAY_NAME';
      throw err;
    }
  }

  // Validate currentMoodId exists in Mood collection (Requirement 9.3)
  if (currentMoodId !== undefined) {
    const mood = await Mood.findById(currentMoodId).lean().exec();
    if (!mood) {
      const err = new Error(
        `Mood identifier "${currentMoodId}" is not recognised.`
      ) as Error & { statusCode: number; code: string };
      err.statusCode = 400;
      err.code = 'INVALID_MOOD_ID';
      throw err;
    }
  }

  // Build update object — only include provided fields
  const updateFields: Record<string, unknown> = {};
  if (displayName !== undefined) updateFields.displayName = displayName;
  if (currentMoodId !== undefined) updateFields.currentMoodId = currentMoodId;

  if (Object.keys(updateFields).length === 0) {
    // Nothing to update — return current profile
    return getPublicProfile(userId);
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateFields },
    { new: true, runValidators: true }
  )
    .select('displayName avatarUrl currentMoodId lastActivityAt')
    .lean()
    .exec();

  if (!updatedUser) {
    const err = new Error('User not found.') as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  // Broadcast mood change side effects when currentMoodId was updated
  if (currentMoodId !== undefined) {
    try {
      const io = getIO();

      // Emit presence_update to all connected clients (Requirement 9.4)
      io.emit('presence_update', { userId, activityLevel: computeActivityLevel(updatedUser.lastActivityAt) });

      // Broadcast pulse_board_update for every group conversation this user belongs to (Requirement 3.7)
      const groupConversations = await Conversation.find({
        'members.userId': new Types.ObjectId(userId),
        type: 'group',
      })
        .select('_id')
        .lean()
        .exec();

      // Fire-and-forget pulse updates — do not block the response
      for (const conv of groupConversations) {
        triggerPulseUpdate(conv._id.toString(), io).catch((err) => {
          console.warn(
            `[profileService] Failed to trigger pulse update for group ${conv._id}:`,
            err
          );
        });
      }
    } catch {
      // Socket.io not yet initialised (e.g. test environment) — log and continue
      console.warn(
        '[profileService] Socket.io not available; mood broadcast skipped.'
      );
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
export async function uploadAvatar(
  userId: string,
  fileBuffer: Buffer,
  mimetype: string
): Promise<{ avatarUrl: string }> {
  // Upload to Cloudinary using a stream from the buffer
  const uploadResult = await new Promise<{ secure_url: string }>(
    (resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'aura/avatars',
          resource_type: 'image',
          // Derive format from mimetype for Cloudinary
          format: mimetypeToFormat(mimetype),
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload returned no result.'));
          } else {
            resolve(result as { secure_url: string });
          }
        }
      );
      uploadStream.end(fileBuffer);
    }
  );

  // Only update DB after a successful Cloudinary upload (Requirement 9.2)
  await User.findByIdAndUpdate(userId, {
    $set: { avatarUrl: uploadResult.secure_url },
  });

  return { avatarUrl: uploadResult.secure_url };
}

/**
 * Maps a MIME type to the Cloudinary format string.
 */
function mimetypeToFormat(mimetype: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return map[mimetype] ?? 'jpg';
}

// ── User search ────────────────────────────────────────────────────────────

export interface UserSearchResult {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  currentMoodId?: string;
  activityLevel: ActivityLevel;
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
export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  if (!q || q.length < 1) {
    const err = new Error(
      'Search query must be at least 1 character.'
    ) as Error & { statusCode: number; code: string };
    err.statusCode = 400;
    err.code = 'QUERY_TOO_SHORT';
    throw err;
  }

  // Escape special regex characters in the query to prevent injection
  const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const users = await User.find({
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

// ── Device token registration ──────────────────────────────────────────────

/**
 * Registers or updates an FCM or APNs device token for the authenticated user.
 *
 * Uses `$addToSet` to avoid duplicates in the `deviceTokens[]` array.
 *
 * Requirements: 10.1
 */
export async function registerDeviceToken(
  userId: string,
  token: string
): Promise<void> {
  if (!token || token.trim().length === 0) {
    const err = new Error('Device token must not be empty.') as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 400;
    err.code = 'INVALID_DEVICE_TOKEN';
    throw err;
  }

  await User.findByIdAndUpdate(userId, {
    $addToSet: { deviceTokens: token.trim() },
  });
}
