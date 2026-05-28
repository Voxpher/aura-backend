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
exports.MoodSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MoodSchema = new mongoose_1.Schema({
    /** String _id — overrides the default ObjectId (Requirement 2.3) */
    _id: {
        type: String,
        required: true,
    },
    label: {
        type: String,
        required: true,
        trim: true,
    },
    /** Hex color, e.g. "#FFD700" (Requirement 2.5, 3.4) */
    color: {
        type: String,
        required: true,
        match: /^#[0-9A-Fa-f]{6}$/,
    },
    /** Maps to a client-side animation preset (Requirement 2.5) */
    animationPreset: {
        type: String,
        required: true,
    },
    /** Marks the fallback/default mood (Requirement 2.5) */
    isDefault: {
        type: Boolean,
        required: true,
        default: false,
    },
}, {
    timestamps: false, // static reference data — no need for timestamps
    // Disable the automatic _id cast so our string _id is preserved
    _id: false,
});
exports.MoodSchema = MoodSchema;
const Mood = mongoose_1.default.model('Mood', MoodSchema);
exports.default = Mood;
//# sourceMappingURL=Mood.js.map