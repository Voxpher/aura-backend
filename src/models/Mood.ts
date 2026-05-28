import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * TypeScript interface for a Mood document.
 *
 * Moods are static reference data seeded at startup.
 * The `_id` is a human-readable string (e.g. "happy", "calm", "neutral")
 * rather than an auto-generated ObjectId.
 *
 * Requirements: 2.3, 2.5, 2.7, 3.4, 3.5, 9.3
 */
export interface IMood extends Document {
  /** Human-readable slug used as the mood identifier, e.g. "happy" */
  _id: string;
  /** Display label shown in the UI, e.g. "Happy" (Requirement 2.7) */
  label: string;
  /** Hex color string, e.g. "#FFD700" — used for Aura bubble and Pulse Board (Requirement 2.5, 3.4) */
  color: string;
  /** Animation preset key, e.g. "pulse_fast" (Requirement 2.5) */
  animationPreset: string;
  /** Exactly one mood should have isDefault = true ("neutral") (Requirement 2.5) */
  isDefault: boolean;
}

const MoodSchema = new Schema<IMood>(
  {
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
  },
  {
    timestamps: false, // static reference data — no need for timestamps
    // Disable the automatic _id cast so our string _id is preserved
    _id: false,
  }
);

const Mood: Model<IMood> = mongoose.model<IMood>('Mood', MoodSchema);

export { MoodSchema };
export default Mood;
