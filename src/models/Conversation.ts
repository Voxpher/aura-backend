import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * Conversation type — direct (1-to-1) or group.
 * Requirements: 8.3, 8.8
 */
export type ConversationType = 'direct' | 'group';

/**
 * Member role within a conversation.
 * Requirements: 8.5
 */
export type MemberRole = 'admin' | 'member';

/**
 * Embedded member sub-document.
 */
export interface IConversationMember {
  userId: Types.ObjectId;
  role: MemberRole;
  joinedAt: Date;
}

/**
 * TypeScript interface for a Conversation document.
 * Requirements: 8.3, 8.5, 8.6, 8.8
 */
export interface IConversation extends Document {
  type: ConversationType;
  /** Required for group conversations; 1–50 chars (Requirement 8.3) */
  name?: string;
  members: IConversationMember[];
  /** Updated whenever a new message is sent — used for sort order (Requirement 8.6) */
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationMemberSchema = new Schema<IConversationMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'member'] satisfies MemberRole[],
      required: true,
      default: 'member',
    },
    joinedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  { _id: false } // no separate _id for embedded sub-docs
);

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['direct', 'group'] satisfies ConversationType[],
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
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
/** Enables efficient lookup of all conversations a user belongs to (Requirement 8.6) */
ConversationSchema.index({ 'members.userId': 1 });

const Conversation: Model<IConversation> = mongoose.model<IConversation>(
  'Conversation',
  ConversationSchema
);

export { ConversationSchema };
export default Conversation;
