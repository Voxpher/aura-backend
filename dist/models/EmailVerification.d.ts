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
import { Document, Model, Types } from 'mongoose';
/**
 * Stores a one-time email verification token.
 * The document is automatically deleted by MongoDB TTL after 24 hours.
 *
 * Flow:
 *   1. User registers → token created → verification email sent
 *   2. User clicks link → GET /auth/verify-email?token=xxx
 *   3. Token found → user.isEmailVerified = true → token deleted
 */
export interface IEmailVerification extends Document {
    userId: Types.ObjectId;
    token: string;
    expiresAt: Date;
}
/** Generate a secure random token */
export declare function generateVerificationToken(): string;
declare const EmailVerification: Model<IEmailVerification>;
export default EmailVerification;
//# sourceMappingURL=EmailVerification.d.ts.map