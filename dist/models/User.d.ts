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
 * Per-conversation notification preference map.
 * Keys are conversation IDs (as strings), values are booleans.
 */
export interface INotificationPrefs {
    [conversationId: string]: boolean;
}
/**
 * TypeScript interface for a User document.
 * Requirements: 1.1, 1.6, 1.7, 6.2, 9.3, 9.5, 10.6
 */
export interface IUser extends Document {
    username: string;
    email: string;
    passwordHash: string;
    displayName: string;
    avatarUrl?: string;
    currentMoodId?: string;
    lastActivityAt?: Date;
    lockedUntil?: Date;
    failedLoginAttempts: number;
    deviceTokens: string[];
    notificationPrefs: INotificationPrefs;
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const UserSchema: mongoose.Schema<IUser, mongoose.Model<IUser, any, any, any, mongoose.Document<unknown, any, IUser> & IUser & {
    _id: mongoose.Types.ObjectId;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, IUser, mongoose.Document<unknown, {}, mongoose.FlatRecord<IUser>> & mongoose.FlatRecord<IUser> & {
    _id: mongoose.Types.ObjectId;
}>;
declare const User: Model<IUser>;
export { UserSchema };
export default User;
//# sourceMappingURL=User.d.ts.map