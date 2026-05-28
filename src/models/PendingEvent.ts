import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * Known event types stored in the offline delivery queue.
 * The type is kept as a string to remain extensible.
 * Requirements: 4.10, 7.4
 */
export type PendingEventType = 'capsule_unlock' | 'new_message' | string;

/**
 * TypeScript interface for a PendingEvent document.
 *
 * PendingEvents are written when a real-time event cannot be delivered
 * because the recipient is offline. They are drained and emitted within
 * 5 seconds of the recipient reconnecting.
 *
 * Requirements: 4.10, 7.4
 */
export interface IPendingEvent extends Document {
  /** The offline user who should receive this event (Requirement 7.4) */
  recipientId: Types.ObjectId;
  /** Socket event name, e.g. "capsule_unlock", "new_message" */
  eventType: PendingEventType;
  /** Arbitrary event payload — mirrors the Socket.io event payload */
  payload: Record<string, unknown>;
  createdAt: Date;
}

const PendingEventSchema = new Schema<IPendingEvent>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    createdAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    // Disable automatic updatedAt — pending events are write-once, then deleted
    timestamps: false,
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
/**
 * Compound index for efficient offline delivery drain:
 * fetch all pending events for a recipient ordered by creation time.
 * Requirements: 4.10, 7.4
 */
PendingEventSchema.index({ recipientId: 1, createdAt: 1 });

const PendingEvent: Model<IPendingEvent> = mongoose.model<IPendingEvent>(
  'PendingEvent',
  PendingEventSchema
);

export { PendingEventSchema };
export default PendingEvent;
