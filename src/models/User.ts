import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Per-conversation notification preference map.
 * Keys are conversation IDs (as strings), values are booleans.
 */
export interface INotificationPrefs {
  [conversationId: string]: boolean;
}

/**
 * TypeScript interface for a User document.
 * Requirements: 1.1, 1.6, 1.7, 6.2, 9.3, 9.5, 10.6
 */
export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  currentMoodId?: string;
  lastActivityAt?: Date;
  lockedUntil?: Date;
  failedLoginAttempts: number;
  deviceTokens: string[];
  notificationPrefs: INotificationPrefs;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    /** bcrypt hash — cost factor ≥ 12 (Requirement 1.6) */
    passwordHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 30,
    },
    /** Cloudinary URL (Requirement 9.2) */
    avatarUrl: {
      type: String,
      default: undefined,
    },
    /** e.g. "happy", "calm", "neutral" (Requirement 9.3) */
    currentMoodId: {
      type: String,
      default: undefined,
    },
    /** Updated on every user interaction — drives Presence Ring (Requirement 6.2) */
    lastActivityAt: {
      type: Date,
      default: undefined,
    },
    /** Non-null while account is locked after repeated failures (Requirement 1.7) */
    lockedUntil: {
      type: Date,
      default: undefined,
    },
    /** Incremented on each failed login; reset to 0 on success (Requirement 1.7) */
    failedLoginAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    /** FCM / APNs device tokens (Requirement 10.1) */
    deviceTokens: {
      type: [String],
      default: [],
    },
    /** Per-conversation push notification toggles (Requirement 10.6) */
    notificationPrefs: {
      type: Schema.Types.Mixed,
      default: {},
    },
    /** Whether the user has verified their email address */
    isEmailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
// Unique indexes are already created by `unique: true` above.
// No additional compound indexes needed for the User collection.

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export { UserSchema };
export default User;
