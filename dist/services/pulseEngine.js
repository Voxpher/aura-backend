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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerPulseUpdate = exports.computePulseColor = exports.rgbToHex = exports.hexToRgb = void 0;
const User_1 = __importDefault(require("../models/User"));
const Mood_1 = __importDefault(require("../models/Mood"));
/** Neutral mood color — used when no active members exist (Requirement 3.6) */
const NEUTRAL_COLOR = '#A9A9A9';
/** Active window: members who updated their mood within the last 30 minutes (Requirement 3.4, 3.5) */
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;
/**
 * Parses a 6-digit hex color string into its RGB components.
 *
 * @param hex - A hex color string, e.g. "#FFD700" or "FFD700"
 * @returns RGB object with r, g, b in range 0–255
 */
function hexToRgb(hex) {
    const clean = hex.replace(/^#/, '');
    return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
    };
}
exports.hexToRgb = hexToRgb;
/**
 * Converts RGB channel values back to a 6-digit uppercase hex string.
 *
 * @param rgb - RGB object with r, g, b in range 0–255
 * @returns Hex color string, e.g. "#FFD700"
 */
function rgbToHex(rgb) {
    const toHex = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}
exports.rgbToHex = rgbToHex;
/**
 * Computes the blended Pulse Board color from a list of member mood contributions.
 *
 * Algorithm (Requirement 3.4, 3.5, 3.6):
 * 1. Filter contributions to those with `lastMoodAt` within the last 30 minutes.
 * 2. If no active contributions remain, return the Neutral color (#A9A9A9).
 * 3. Compute equal-weight additive blend:
 *    R = Σ(r_i) / n,  G = Σ(g_i) / n,  B = Σ(b_i) / n
 *    where n = number of active members.
 * 4. Return the result as a hex string.
 *
 * @param contributions - Array of mood contributions from group members
 * @returns Blended hex color string
 */
function computePulseColor(contributions) {
    const now = Date.now();
    // Filter to members who updated their mood within the active window
    const active = contributions.filter((c) => now - c.lastMoodAt.getTime() <= ACTIVE_WINDOW_MS);
    if (active.length === 0) {
        return NEUTRAL_COLOR;
    }
    const n = active.length;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (const contribution of active) {
        const { r, g, b } = hexToRgb(contribution.color);
        sumR += r;
        sumG += g;
        sumB += b;
    }
    return rgbToHex({ r: sumR / n, g: sumG / n, b: sumB / n });
}
exports.computePulseColor = computePulseColor;
/**
 * Fetches all members of a group conversation, resolves their current mood colors,
 * computes the blended Pulse Board color, and broadcasts `pulse_board_update` to
 * the group's Socket.io room.
 *
 * Emitted event payload: `{ groupId, blendedColor, activeCount }`
 *
 * Requirements: 3.2, 3.7, 3.8
 *
 * @param groupId - The conversation (group) ID whose Pulse Board should be updated
 * @param io      - The Socket.io server instance used to emit the event
 */
async function triggerPulseUpdate(groupId, io) {
    // Fetch all members of the group conversation
    const Conversation = (await Promise.resolve().then(() => __importStar(require('../models/Conversation')))).default;
    const conversation = await Conversation.findById(groupId).lean().exec();
    if (!conversation) {
        console.warn(`[PulseEngine] Conversation not found: ${groupId}`);
        return;
    }
    // Collect member user IDs
    const memberIds = conversation.members.map((m) => m.userId);
    // Fetch users with their current mood and last activity
    const users = await User_1.default.find({ _id: { $in: memberIds } }, { currentMoodId: 1, updatedAt: 1 })
        .lean()
        .exec();
    // Build mood contributions by resolving each user's current mood color
    const contributions = [];
    for (const user of users) {
        if (!user.currentMoodId) {
            // No mood set — treat as Neutral with a very old timestamp so it falls outside the window
            contributions.push({
                color: NEUTRAL_COLOR,
                lastMoodAt: new Date(0),
            });
            continue;
        }
        const mood = await Mood_1.default.findById(user.currentMoodId).lean().exec();
        const color = mood?.color ?? NEUTRAL_COLOR;
        // Use the user's updatedAt as a proxy for when their mood was last set.
        // The profile PATCH endpoint updates this timestamp whenever currentMoodId changes.
        const lastMoodAt = user.updatedAt instanceof Date
            ? user.updatedAt
            : new Date(user.updatedAt ?? 0);
        contributions.push({ color, lastMoodAt });
    }
    const blendedColor = computePulseColor(contributions);
    // Count active members (those whose mood was updated within the last 30 minutes)
    const now = Date.now();
    const activeCount = contributions.filter((c) => now - c.lastMoodAt.getTime() <= ACTIVE_WINDOW_MS).length;
    // Broadcast to the group's Socket.io room (Requirement 3.7, 3.8)
    io.to(groupId).emit('pulse_board_update', {
        groupId,
        blendedColor,
        activeCount,
    });
}
exports.triggerPulseUpdate = triggerPulseUpdate;
//# sourceMappingURL=pulseEngine.js.map