"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllMoods = exports.getMoodById = exports.seedMoods = void 0;
const Mood_1 = __importDefault(require("../models/Mood"));
/**
 * Seed data for the Mood reference collection.
 *
 * Each entry maps to the IMood schema:
 *   _id            — human-readable slug used as the mood identifier
 *   label          — display label shown in the UI (Requirement 2.1, 2.7)
 *   color          — hex color for Aura bubble and Pulse Board (Requirement 2.5, 3.4)
 *   animationPreset — client-side animation key (Requirement 2.5)
 *   isDefault      — exactly one mood is the fallback ("neutral") (Requirement 2.4, 2.5)
 */
const MOOD_SEEDS = [
    {
        _id: 'happy',
        label: 'Happy',
        color: '#FFD700',
        animationPreset: 'pulse_fast',
        isDefault: false,
    },
    {
        _id: 'calm',
        label: 'Calm',
        color: '#87CEEB',
        animationPreset: 'pulse_slow',
        isDefault: false,
    },
    {
        _id: 'anxious',
        label: 'Anxious',
        color: '#FF8C00',
        animationPreset: 'pulse_jitter',
        isDefault: false,
    },
    {
        _id: 'excited',
        label: 'Excited',
        color: '#FF4500',
        animationPreset: 'pulse_burst',
        isDefault: false,
    },
    {
        _id: 'sad',
        label: 'Sad',
        color: '#4169E1',
        animationPreset: 'pulse_fade',
        isDefault: false,
    },
    {
        _id: 'angry',
        label: 'Angry',
        color: '#DC143C',
        animationPreset: 'pulse_sharp',
        isDefault: false,
    },
    {
        _id: 'neutral',
        label: 'Neutral',
        color: '#A9A9A9',
        animationPreset: 'pulse_steady',
        isDefault: true,
    },
    {
        _id: 'hopeful',
        label: 'Hopeful',
        color: '#32CD32',
        animationPreset: 'pulse_rise',
        isDefault: false,
    },
];
/**
 * Upserts all mood seed entries into MongoDB.
 *
 * Using `updateOne` with `upsert: true` makes this operation idempotent —
 * safe to call on every app startup without creating duplicates or
 * overwriting manual edits to fields not included in `$setOnInsert`.
 *
 * Called from `bootstrap()` in server.ts after `ensureIndexes()`.
 */
async function seedMoods() {
    const ops = MOOD_SEEDS.map((mood) => Mood_1.default.updateOne({ _id: mood._id }, { $set: mood }, { upsert: true }));
    await Promise.all(ops);
    console.log(`Mood seed complete — ${MOOD_SEEDS.length} moods upserted`);
}
exports.seedMoods = seedMoods;
/**
 * Returns the Mood document for the given id, or null if not found.
 *
 * @param id - The mood slug, e.g. "happy", "neutral"
 */
async function getMoodById(id) {
    return Mood_1.default.findById(id).exec();
}
exports.getMoodById = getMoodById;
/**
 * Returns all Mood documents in the collection.
 */
async function getAllMoods() {
    return Mood_1.default.find().exec();
}
exports.getAllMoods = getAllMoods;
//# sourceMappingURL=moods.js.map