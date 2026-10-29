import mongoose, { Schema, Types } from "mongoose";

// Last AI clinical narrative per person (account holder or family member),
// reused while the summary data is unchanged
export interface IClinicalNarrative {
  userId: Types.ObjectId;
  profileId: Types.ObjectId | null;
  fingerprint: string;
  narrative: string;
  generatedAt: Date;
}

const ClinicalNarrativeSchema = new Schema<IClinicalNarrative>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  profileId: { type: Schema.Types.ObjectId, default: null },
  fingerprint: { type: String, required: true },
  narrative: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
});
ClinicalNarrativeSchema.index({ userId: 1, profileId: 1 }, { unique: true });

// New collection name: the first version had a unique index on userId alone
export const ClinicalNarrativeModel = mongoose.model<IClinicalNarrative>(
  "ClinicalNarrative",
  ClinicalNarrativeSchema,
  "clinicalnarrativecache"
);
