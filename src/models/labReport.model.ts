import mongoose, { Schema, Document, Types } from "mongoose";

export interface ILabResult {
  name: string;
  value: number | null;
  valueText: string;
  unit: string | null;
  referenceRange: string | null;
  status: "normal" | "high" | "low" | "unknown";
}

export interface ILabReport extends Document {
  userId: Types.ObjectId;
  familyMemberId?: Types.ObjectId | null;
  imageUrl: string;
  reportDate: Date;
  results: ILabResult[];
  summaryBn: string;
  summaryEn: string;
  createdAt: Date;
}

const LabResultSchema = new Schema<ILabResult>(
  {
    name: { type: String, required: true },
    value: { type: Number, default: null },
    valueText: { type: String, default: "" },
    unit: { type: String, default: null },
    referenceRange: { type: String, default: null },
    status: { type: String, enum: ["normal", "high", "low", "unknown"], default: "unknown" },
  },
  { _id: false }
);

const LabReportSchema = new Schema<ILabReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyMemberId: { type: Schema.Types.ObjectId, ref: "FamilyMember", default: null },
    imageUrl: { type: String, default: "" },
    reportDate: { type: Date, required: true, index: true },
    results: { type: [LabResultSchema], default: [] },
    summaryBn: { type: String, default: "" },
    summaryEn: { type: String, default: "" },
  },
  { timestamps: true }
);

LabReportSchema.index({ userId: 1, reportDate: -1 });

export const LabReportModel = mongoose.model<ILabReport>("LabReport", LabReportSchema);
