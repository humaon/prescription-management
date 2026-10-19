// src/models/reminder.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReminderDocument extends Document {
  userId: Types.ObjectId;
  profileId?: Types.ObjectId | null; // copied from the prescription
  prescriptionId: Types.ObjectId;
  medicineName: string;
  dosage: string;
  schedules: {
    morning: boolean;
    noon: boolean;
    night: boolean;
  };
  
  timings: {
    morning: string; // "08:00"
    noon: string; // "13:00"
    night: string; // "20:00"
  };
  // "daily" (default) or "weekly"; as-needed / one-time medicines get no reminder
  scheduleType: "daily" | "weekly";
  // 0=Sun..6=Sat in the app timezone; [] = every day
  daysOfWeek: number[];
  isActive: boolean;
  // Refill tracking (opt-in): units on hand, used per dose, last "running low" alert
  stockCount?: number | null;
  unitsPerDose: number;
  refillAlertedAt?: Date | null;
  startDate: Date;
  endDate?: Date | null;
  lastNotifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminderDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    profileId: { type: Schema.Types.ObjectId, default: null },
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
    },
    dosage: {
      type: String,
      default: "",
    },
    schedules: {
      morning: { type: Boolean, default: false },
      noon: { type: Boolean, default: false },
      night: { type: Boolean, default: false },
    },
    timings: {
      morning: { type: String, default: "08:00" },
      noon: { type: String, default: "13:00" },
      night: { type: String, default: "20:00" },
    },
    scheduleType: {
      type: String,
      enum: ["daily", "weekly"],
      default: "daily",
    },
    daysOfWeek: {
      type: [Number],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    stockCount: { type: Number, default: null },
    unitsPerDose: { type: Number, default: 1 },
    refillAlertedAt: { type: Date, default: null },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for active reminders
ReminderSchema.index({
  userId: 1,
  isActive: 1,
  startDate: 1,
});

export const ReminderModel = mongoose.model<IReminderDocument>(
  "Reminder",
  ReminderSchema
);