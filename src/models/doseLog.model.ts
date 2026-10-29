import mongoose, { Schema, Types } from "mongoose";

export type DoseSlot = "morning" | "noon" | "night";

// One document per dose the user marked as taken
export interface IDoseLog {
  userId: Types.ObjectId;
  reminderId: Types.ObjectId;
  slot: DoseSlot;
  date: string; // YYYY-MM-DD in the app's timezone
  takenAt: Date;
}

const DoseLogSchema = new Schema<IDoseLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reminderId: { type: Schema.Types.ObjectId, ref: "Reminder", required: true },
    slot: { type: String, enum: ["morning", "noon", "night"], required: true },
    date: { type: String, required: true },
    takenAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

DoseLogSchema.index({ reminderId: 1, slot: 1, date: 1 }, { unique: true });

export const DoseLogModel = mongoose.model<IDoseLog>("DoseLog", DoseLogSchema);
