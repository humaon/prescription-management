import mongoose, { Schema, Types } from "mongoose";

// Time-limited, read-only summary link for a doctor. Only the SHA-256 of the
// token is stored, so a database leak doesn't expose working links.
export interface IShareLink {
  tokenHash: string;
  userId: Types.ObjectId;
  profileId: Types.ObjectId | null;
  expiresAt: Date;
  revokedAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
  createdAt: Date;
}

const ShareLinkSchema = new Schema<IShareLink>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    profileId: { type: Schema.Types.ObjectId, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Expired links are removed by MongoDB a day after they stop working
ShareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const ShareLinkModel = mongoose.model<IShareLink>("ShareLink", ShareLinkSchema);
