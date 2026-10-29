import mongoose, { Schema, Document } from "mongoose";

export interface IAiUsage extends Document {
  scope: string; // "global" or "u:<userId>:<feature>"
  date: string; // YYYY-MM-DD (UTC)
  count: number;
  expireAt: Date;
}

const AiUsageSchema = new Schema<IAiUsage>({
  scope: { type: String, required: true },
  date: { type: String, required: true },
  count: { type: Number, default: 0 },
  expireAt: { type: Date, required: true },
});

AiUsageSchema.index({ scope: 1, date: 1 }, { unique: true });
AiUsageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const AiUsageModel = mongoose.model<IAiUsage>("AiUsage", AiUsageSchema);
