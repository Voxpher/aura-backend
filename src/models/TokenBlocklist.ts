import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Represents a revoked JWT stored in the server-side blocklist.
 * Documents are automatically removed by MongoDB's TTL mechanism
 * once the token's expiry time has passed.
 *
 * Requirements: 1.8
 */
export interface ITokenBlocklist extends Document {
  jti: string;
  expiresAt: Date;
}

const TokenBlocklistSchema = new Schema<ITokenBlocklist>({
  jti: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  /** TTL index — MongoDB removes the document automatically after this date. */
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
});

const TokenBlocklist: Model<ITokenBlocklist> = mongoose.model<ITokenBlocklist>(
  'TokenBlocklist',
  TokenBlocklistSchema
);

export default TokenBlocklist;
