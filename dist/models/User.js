"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    /** Whether the user has verified their email address */
    isEmailVerified: {
        type: Boolean,
        required: true,
        default: false,
    },
}, {
    timestamps: true, // adds createdAt and updatedAt
});
exports.UserSchema = UserSchema;
// ── Indexes ────────────────────────────────────────────────────────────────
// Unique indexes are already created by `unique: true` above.
// No additional compound indexes needed for the User collection.
const User = mongoose_1.default.model('User', UserSchema);
exports.default = User;
//# sourceMappingURL=User.js.map