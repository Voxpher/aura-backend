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
declare const ConversationSchema: mongoose.Schema<IConversation, mongoose.Model<IConversation, any, any, any, mongoose.Document<unknown, any, IConversation> & IConversation & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, IConversation, mongoose.Document<unknown, {}, mongoose.FlatRecord<IConversation>> & mongoose.FlatRecord<IConversation> & {
    _id: Types.ObjectId;
}>;
declare const Conversation: Model<IConversation>;
export { ConversationSchema };
export default Conversation;
//# sourceMappingURL=Conversation.d.ts.map