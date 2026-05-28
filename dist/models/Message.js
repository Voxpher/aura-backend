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
exports.MessageSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CapsuleSchema = new mongoose_1.Schema({
    enabled: {
        type: Boolean,
        required: true,
        default: false,
    },
    type: {
        type: String,
        enum: ['time', 'condition'],
        default: undefined,
    },
    /** For time-based capsules — must be ≥ 1 minute in the future at creation (Requirement 4.2) */
    unlockAt: {
        type: Date,
        default: undefined,
    },
    /** For condition-based capsules (Requirement 4.4) */
    conditionId: {
        type: String,
        default: undefined,
    },
    status: {
        type: String,
        enum: ['locked', 'unlocked'],
        default: 'locked',
    },
}, { _id: false });
const MessageSchema = new mongoose_1.Schema({
    conversationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    senderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    /** Mood identifier — e.g. "happy", "neutral" (Requirement 2.3) */
    moodId: {
        type: String,
        required: true,
    },
    /** Null for top-level messages; ObjectId of parent for Echo Thread replies (Requirement 5.3) */
    parentMessageId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Message',
        default: undefined,
    },
    /** Nesting depth: 0 = top-level, max 5 (Requirement 5.6) */
    depth: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        max: 5,
    },
    /** Optional capsule configuration (Requirement 4.2) */
    capsule: {
        type: CapsuleSchema,
        default: undefined,
    },
    /** User IDs that have received a delivery receipt (Requirement 7.3) */
    deliveredTo: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: 'User',
        default: [],
    },
    /** User IDs that have opened/read the message */
    readBy: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: 'User',
        default: [],
    },
}, {
    timestamps: true, // adds createdAt and updatedAt
});
exports.MessageSchema = MessageSchema;
// ── Indexes ────────────────────────────────────────────────────────────────
/** Paginated message history for a conversation (Requirement 2.1) */
MessageSchema.index({ conversationId: 1, createdAt: -1 });
/** Echo Thread fetch — all replies for a given parent (Requirement 5.3) */
MessageSchema.index({ parentMessageId: 1 });
/** Capsule unlock scheduler — find locked capsules whose time has come (Requirement 4.6) */
MessageSchema.index({ 'capsule.unlockAt': 1, 'capsule.status': 1 });
const Message = mongoose_1.default.model('Message', MessageSchema);
exports.default = Message;
//# sourceMappingURL=Message.js.map