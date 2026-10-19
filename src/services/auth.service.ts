import { MESSAGES } from "../lib/constants";
import { signToken } from "../lib/jwt";
import { comparePassword, hashPassword } from "../lib/password";
import { IUser, User } from "../models/user.model";
import { sendOTP, verifyOTP } from "./otp.service";
import fs from "fs/promises";
import path from "path";
import { appConfig } from "../config/app.config";
import { PrescriptionModel } from "../models/prescription.model";
import { ReminderModel } from "../models/reminder.model";
import { DoseLogModel } from "../models/doseLog.model";
import { PrescriptionFeedbackModel } from "../models/PrescriptionFeedback.model";
import { OTP } from "../models/otp.model";

export const signupWithEmailService = async (
  email: string,
  password: string,
  fullName: string
): Promise<{ user: IUser; token: string }> => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error(MESSAGES.USER_EXISTS);
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({
    email,
    password: hashedPassword,
    fullName,
    isVerified: true,
  });

  const token = signToken({ id: user._id });
  console.log(`✅ User signed up with email: ${email}`);

  return { user, token };
};

export const signupMobileRequestService = async (
  mobileNumber: string
): Promise<void> => {
  const existingUser = await User.findOne({ mobileNumber });
  if (existingUser) {
    throw new Error(MESSAGES.USER_EXISTS);
  }

  await sendOTP(mobileNumber);
};

export const signupMobileVerifyService = async (
  mobileNumber: string,
  code: string,
  password: string,
  fullName: string
): Promise<{ user: IUser; token: string }> => {
  const isValid = await verifyOTP(mobileNumber, code);
  if (!isValid) {
    throw new Error(MESSAGES.INVALID_OTP);
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({
    mobileNumber,
    password: hashedPassword,
    fullName,
    isVerified: true,
  });

  const token = signToken({ id: user._id });
  console.log(`✅ User verified and account created: ${mobileNumber}`);

  return { user, token };
};

export const loginService = async (
  email: string,
  password: string
): Promise<{ user: IUser; token: string }> => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(MESSAGES.INVALID_CREDENTIALS);
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    throw new Error(MESSAGES.INVALID_CREDENTIALS);
  }

  const token = signToken({ id: user._id });
  console.log(`✅ User logged in: ${email}`);

  return { user, token };
};

// Permanently delete a user's account and all associated data (Play Store requirement)
export const deleteAccountService = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const prescriptions = await PrescriptionModel.find({ userId: user._id }, { tests: 1 });

  // Remove uploaded test report files from disk
  const reportFiles = prescriptions
    .flatMap((p) => p.tests || [])
    .map((t) => t.reportUrl)
    .filter((url): url is string => !!url && url.includes("/uploads/"))
    .map((url) => path.join(process.cwd(), appConfig.UPLOAD_DIR, path.basename(url)));
  await Promise.all(reportFiles.map((file) => fs.unlink(file).catch(() => undefined)));

  await Promise.all([
    PrescriptionFeedbackModel.deleteMany({ userId: user._id }),
    ReminderModel.deleteMany({ userId: user._id }),
    DoseLogModel.deleteMany({ userId: user._id }),
    PrescriptionModel.deleteMany({ userId: user._id }),
    user.mobileNumber ? OTP.deleteMany({ mobileNumber: user.mobileNumber }) : Promise.resolve(),
  ]);

  // User document also holds device FCM tokens
  await User.deleteOne({ _id: user._id });
};
