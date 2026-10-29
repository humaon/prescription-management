import mongoose, { Document, Schema } from "mongoose";

export interface IOTP extends Document {
  mobileNumber?: string;
  email?: string;
  code: string;
  attempts: number;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<IOTP>(
  {
    mobileNumber: { type: String, index: true },
    email: { type: String, index: true },
    code: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model<IOTP>("OTP", otpSchema);
