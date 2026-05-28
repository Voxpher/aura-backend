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
exports.PendingEventSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PendingEventSchema = new mongoose_1.Schema({
    recipientId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    /** e.g. "capsule_unlock", "new_message" (Requirement 4.10, 7.4) */
    eventType: {
        type: String,
        required: true,
    },
    /** Flexible payload object — stored as Mixed to accommodate any event shape */
    payload: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
        default: {},
    },
    createdAt: {
        type: Date,
        required: true,
        default: () => new Date(),
    },
}, {
    // Disable automatic updatedAt — pending events are write-once, then deleted
    timestamps: false,
});
exports.PendingEventSchema = PendingEventSchema;
// ── Indexes ────────────────────────────────────────────────────────────────
/**
 * Compound index for efficient offline delivery drain:
 * fetch all pending events for a recipient ordered by creation time.
 * Requirements: 4.10, 7.4
 */
PendingEventSchema.index({ recipientId: 1, createdAt: 1 });
const PendingEvent = mongoose_1.default.model('PendingEvent', PendingEventSchema);
exports.default = PendingEvent;
//# sourceMappingURL=PendingEvent.js.map