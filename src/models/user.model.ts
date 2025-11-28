import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email?: string;
  mobileNumber?: string;
  fullName: string;
  password: string;
  googleId?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, sparse: true },
    mobileNumber: { type: String, unique: true, sparse: true },
    fullName: { type: String, required: true },
    password: { type: String, required: true },
    googleId: { type: String, unique: true, sparse: true },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
