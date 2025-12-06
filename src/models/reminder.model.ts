// src/models/reminder.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReminderDocument extends Document {
  userId: Types.ObjectId;
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
  isActive: boolean;
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
      required: true,
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
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