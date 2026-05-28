/// <reference types="node" />
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
export declare function computeActivityLevel(lastActivityAt?: Date): ActivityLevel;
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
export declare function getPublicProfile(userId: string): Promise<PublicProfile>;
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
export declare function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicProfile>;
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
export declare function uploadAvatar(userId: string, fileBuffer: Buffer, mimetype: string): Promise<{
    avatarUrl: string;
}>;
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
export declare function searchUsers(q: string): Promise<UserSearchResult[]>;
/**
 * Registers or updates an FCM or APNs device token for the authenticated user.
 *
 * Uses `$addToSet` to avoid duplicates in the `deviceTokens[]` array.
 *
 * Requirements: 10.1
 */
export declare function registerDeviceToken(userId: string, token: string): Promise<void>;
//# sourceMappingURL=profileService.d.ts.map