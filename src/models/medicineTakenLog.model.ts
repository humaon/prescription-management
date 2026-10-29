import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMedicineTakenLog extends Document {
  userId: Types.ObjectId;
  reminderId: Types.ObjectId;
  prescriptionId: Types.ObjectId;
  medicineName: string;
  dosage: string;
  timeSlot: "morning" | "noon" | "night";
  scheduledDate: Date;
  status: "taken" | "skipped" | "delayed" | "missed";
  takenAt?: Date | null;
  note?: string | null;
  caregiverNotified: boolean;
  createdAt: Date;
}

const MedicineTakenLogSchema = new Schema<IMedicineTakenLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reminderId: { type: Schema.Types.ObjectId, ref: "Reminder", required: true },
    prescriptionId: { type: Schema.Types.ObjectId, ref: "Prescription", required: true },
    medicineName: { type: String, required: true },
    dosage: { type: String, default: "" },
    timeSlot: { type: String, enum: ["morning", "noon", "night"], required: true },
    scheduledDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ["taken", "skipped", "delayed", "missed"], required: true },
    takenAt: { type: Date, default: null },
    note: { type: String, default: null },
    caregiverNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MedicineTakenLogSchema.index({ userId: 1, scheduledDate: -1 });
MedicineTakenLogSchema.index(
  { userId: 1, reminderId: 1, scheduledDate: 1, timeSlot: 1 },
  { unique: true }
);

export const MedicineTakenLogModel = mongoose.model<IMedicineTakenLog>(
  "MedicineTakenLog",
  MedicineTakenLogSchema
);
