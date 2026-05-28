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
exports.ConversationSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ConversationMemberSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'member'],
        required: true,
        default: 'member',
    },
    joinedAt: {
        type: Date,
        required: true,
        default: () => new Date(),
    },
}, { _id: false } // no separate _id for embedded sub-docs
);
const ConversationSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ['direct', 'group'],
        required: true,
    },
    /** Only required for group conversations (Requirement 8.3) */
    name: {
        type: String,
        trim: true,
        minlength: 1,
        maxlength: 50,
        default: undefined,
    },
    members: {
        type: [ConversationMemberSchema],
        required: true,
        default: [],
    },
    lastMessageAt: {
        type: Date,
        default: undefined,
    },
}, {
    timestamps: true, // adds createdAt and updatedAt
});
exports.ConversationSchema = ConversationSchema;
// ── Indexes ────────────────────────────────────────────────────────────────
/** Enables efficient lookup of all conversations a user belongs to (Requirement 8.6) */
ConversationSchema.index({ 'members.userId': 1 });
const Conversation = mongoose_1.default.model('Conversation', ConversationSchema);
exports.default = Conversation;
//# sourceMappingURL=Conversation.js.map