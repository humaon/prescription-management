import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICareLink extends Document {
  patientId: Types.ObjectId;
  caregiverId: Types.ObjectId;
  status: "pending" | "active";
  createdAt: Date;
}

const CareLinkSchema = new Schema<ICareLink>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    caregiverId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
  },
  { timestamps: true }
);

CareLinkSchema.index({ patientId: 1, caregiverId: 1 }, { unique: true });

export const CareLinkModel = mongoose.model<ICareLink>("CareLink", CareLinkSchema);
