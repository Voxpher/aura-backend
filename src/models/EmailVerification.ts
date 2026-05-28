import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import crypto from 'crypto';

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

const EmailVerificationSchema = new Schema<IEmailVerification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  /** TTL index — MongoDB removes the document automatically after this date */
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
});

/** Generate a secure random token */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const EmailVerification: Model<IEmailVerification> = mongoose.model<IEmailVerification>(
  'EmailVerification',
  EmailVerificationSchema
);

export default EmailVerification;
