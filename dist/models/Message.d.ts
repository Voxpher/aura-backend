/// <reference types="mongoose/types/aggregate" />
/// <reference types="mongoose/types/callback" />
/// <reference types="mongoose/types/collection" />
/// <reference types="mongoose/types/connection" />
/// <reference types="mongoose/types/cursor" />
/// <reference types="mongoose/types/document" />
/// <reference types="mongoose/types/error" />
/// <reference types="mongoose/types/expressions" />
/// <reference types="mongoose/types/helpers" />
/// <reference types="mongoose/types/middlewares" />
/// <reference types="mongoose/types/indexes" />
/// <reference types="mongoose/types/models" />
/// <reference types="mongoose/types/mongooseoptions" />
/// <reference types="mongoose/types/pipelinestage" />
/// <reference types="mongoose/types/populate" />
/// <reference types="mongoose/types/query" />
/// <reference types="mongoose/types/schemaoptions" />
/// <reference types="mongoose/types/schematypes" />
/// <reference types="mongoose/types/session" />
/// <reference types="mongoose/types/types" />
/// <reference types="mongoose/types/utility" />
/// <reference types="mongoose/types/validation" />
/// <reference types="mongoose/types/virtuals" />
/// <reference types="mongoose/types/inferschematype" />
import mongoose, { Document, Model, Types } from 'mongoose';
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
declare const MessageSchema: mongoose.Schema<IMessage, mongoose.Model<IMessage, any, any, any, mongoose.Document<unknown, any, IMessage> & IMessage & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, IMessage, mongoose.Document<unknown, {}, mongoose.FlatRecord<IMessage>> & mongoose.FlatRecord<IMessage> & {
    _id: Types.ObjectId;
}>;
declare const Message: Model<IMessage>;
export { MessageSchema };
export default Message;
//# sourceMappingURL=Message.d.ts.map