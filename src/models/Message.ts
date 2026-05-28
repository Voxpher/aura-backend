import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * Capsule lock type.
 * Requirements: 4.2, 4.3, 4.4
 */
export type CapsuleType = 'time' | 'condition';

/**
 * Capsule lock status.
 * Requirements: 4.5, 4.6, 4.9
 */
export type CapsuleStatus = 'locked' | 'unlocked';

/**
 * Embedded capsule configuration sub-document.
 * Requirements: 4.2–4.12
 */
export interface ICapsule {
  enabled: boolean;
  /** "time" for timestamp-based unlock; "condition" for signal-based unlock */
  type?: CapsuleType;
  /** UTC timestamp at which the capsule unlocks (time-based) (Requirement 4.3) */
  unlockAt?: Date;
  /** Opaque condition identifier (condition-based) (Requirement 4.4) */
  conditionId?: string;
  /** Current lock state (Requirement 4.5) */
  status?: CapsuleStatus;
}

/**
 * TypeScript interface for a Message document.
 * Requirements: 2.3, 2.8, 2.9, 4.2–4.12, 5.3, 5.6, 7.3
 */
export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  /** Mood identifier attached to this message (Requirement 2.3) */
  moodId: string;
  /** Set for Echo Thread replies; null/undefined for top-level messages (Requirement 5.3) */
  parentMessageId?: Types.ObjectId;
  /** 0 = top-level; max 5 (Requirement 5.6) */
  depth: number;
  /** Capsule configuration — present when the message is a Capsule Message (Requirement 4.2) */
  capsule?: ICapsule;
  /** User IDs who have received a delivery receipt (Requirement 7.3) */
  deliveredTo: Types.ObjectId[];
  /** User IDs who have sent a read receipt */
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CapsuleSchema = new Schema<ICapsule>(
  {
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    type: {
      type: String,
      enum: ['time', 'condition'] satisfies CapsuleType[],
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
      enum: ['locked', 'unlocked'] satisfies CapsuleStatus[],
      default: 'locked',
    },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    /** User IDs that have opened/read the message */
    readBy: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
/** Paginated message history for a conversation (Requirement 2.1) */
MessageSchema.index({ conversationId: 1, createdAt: -1 });

/** Echo Thread fetch — all replies for a given parent (Requirement 5.3) */
MessageSchema.index({ parentMessageId: 1 });

/** Capsule unlock scheduler — find locked capsules whose time has come (Requirement 4.6) */
MessageSchema.index({ 'capsule.unlockAt': 1, 'capsule.status': 1 });

const Message: Model<IMessage> = mongoose.model<IMessage>('Message', MessageSchema);

export { MessageSchema };
export default Message;
