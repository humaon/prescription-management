// src/models/user.model.ts (UPDATED)
import mongoose, { Document, Schema } from "mongoose";

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
  deviceTokens: IDeviceToken[]; // NEW
  notificationSettings: {        // NEW
    enabled: boolean;
    medicationReminders: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Device Token Sub-Schema
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
  },
  { timestamps: true }
);

// Keep these - they're the correct indexes
userSchema.index({ "deviceTokens.token": 1 });
userSchema.index({ "deviceTokens.deviceId": 1 });

export const User = mongoose.model<IUser>("User", userSchema);