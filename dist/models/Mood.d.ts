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
import mongoose, { Document, Model } from 'mongoose';
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
declare const MoodSchema: mongoose.Schema<IMood, mongoose.Model<IMood, any, any, any, mongoose.Document<unknown, any, IMood> & IMood & Required<{
    _id: string;
}>, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, IMood, mongoose.Document<unknown, {}, mongoose.FlatRecord<IMood>> & mongoose.FlatRecord<IMood> & Required<{
    _id: string;
}>>;
declare const Mood: Model<IMood>;
export { MoodSchema };
export default Mood;
//# sourceMappingURL=Mood.d.ts.map