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
declare const PendingEventSchema: mongoose.Schema<IPendingEvent, mongoose.Model<IPendingEvent, any, any, any, mongoose.Document<unknown, any, IPendingEvent> & IPendingEvent & {
    _id: Types.ObjectId;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, IPendingEvent, mongoose.Document<unknown, {}, mongoose.FlatRecord<IPendingEvent>> & mongoose.FlatRecord<IPendingEvent> & {
    _id: Types.ObjectId;
}>;
declare const PendingEvent: Model<IPendingEvent>;
export { PendingEventSchema };
export default PendingEvent;
//# sourceMappingURL=PendingEvent.d.ts.map