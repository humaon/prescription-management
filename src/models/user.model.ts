// src/models/user.model.ts (UPDATED)
import mongoose, { Document, Schema, Types } from "mongoose";

// FCM Device Token Interface
export interface IDeviceToken {
  token: string;
  platform: "android" | "ios" | "web";
  deviceId: string;
  lastUsed: Date;
  isActive: boolean;
}

export interface IUser extends Document {
  email?: string;
  mobileNumber?: string;
  fullName: string;
  password: string;
  googleId?: string;
  isVerified: boolean;
  isActive: boolean;
  country?: string;
  currency?: string;
  language: "en" | "bn";
  voiceReminders: boolean;
  bloodGroup?: string | null;
  allergies: string[];
  chronicConditions: string[];
  emergencyContacts: { name: string; phone: string; relation?: string }[];
  deviceTokens: IDeviceToken[]; // NEW
  notificationSettings: {        // NEW
    enabled: boolean;
    medicationReminders: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  // Dose times ("HH:MM", app timezone) for the three reminder slots
  reminderTimes: { morning: string; noon: string; night: string };
  // The phone schedules medicine alarms itself → no server push for doses
  localAlarms: boolean;
  // Known allergies (from prescriptions and the user), checked against new medicines
  allergies: string[];
  // Family members whose prescriptions this account manages (the holder is implicit)
  profiles: Array<{ _id: Types.ObjectId; name: string; relation: string | null; allergies: string[] }>;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_REMINDER_TIMES = { morning: "08:00", noon: "13:00", night: "20:00" };

// Device Token Sub-Schema
const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    token: { 
      type: String, 
      required: true,
      // index: true  ← REMOVE THIS LINE
    },
    platform: { 
      type: String, 
      enum: ["android", "ios", "web"], 
      required: true 
    },
    deviceId: { 
      type: String, 
      required: true,
      // index: true  ← REMOVE THIS LINE
    },
    lastUsed: { 
      type: Date, 
      default: Date.now 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, sparse: true },
    mobileNumber: { type: String, unique: true, sparse: true },
    fullName: { type: String, required: true },
    password: { type: String, required: true },
    googleId: { type: String, unique: true, sparse: true },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    country: { type: String, default: "BD" },
    currency: { type: String, default: "BDT" },
    language: { type: String, enum: ["en", "bn"], default: "bn" },
    voiceReminders: { type: Boolean, default: false },
    bloodGroup: { type: String, default: null },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    emergencyContacts: {
      type: [
        new Schema(
          { name: String, phone: String, relation: String },
          { _id: false }
        ),
      ],
      default: [],
    },

    deviceTokens: {
      type: [DeviceTokenSchema],
      default: [],
    },
    
    notificationSettings: {
      type: {
        enabled: { type: Boolean, default: true },
        medicationReminders: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: false },
        pushNotifications: { type: Boolean, default: true },
      },
      default: {
        enabled: true,
        medicationReminders: true,
        emailNotifications: false,
        pushNotifications: true,
      },
    },

    reminderTimes: {
      morning: { type: String, default: DEFAULT_REMINDER_TIMES.morning },
      noon: { type: String, default: DEFAULT_REMINDER_TIMES.noon },
      night: { type: String, default: DEFAULT_REMINDER_TIMES.night },
    },
    localAlarms: { type: Boolean, default: false },
    allergies: { type: [String], default: [] },
    profiles: {
      type: [
        new Schema(
          {
            name: { type: String, required: true, trim: true, maxlength: 60 },
            relation: { type: String, default: null, maxlength: 40 },
            allergies: { type: [String], default: [] },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Keep these - they're the correct indexes
userSchema.index({ "deviceTokens.token": 1 });
userSchema.index({ "deviceTokens.deviceId": 1 });

export const User = mongoose.model<IUser>("User", userSchema);