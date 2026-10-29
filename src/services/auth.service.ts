import { MESSAGES } from "../lib/constants";
import { signToken } from "../lib/jwt";
import { comparePassword, hashPassword } from "../lib/password";
import { IUser, User } from "../models/user.model";
import { currencyForCountry, languageForCountry } from "../lib/currency";
import { sendEmailOTP, sendOTP, verifyEmailOTP, verifyOTP } from "./otp.service";
import { deleteReport } from "../lib/reportStorage";
import { PrescriptionModel } from "../models/prescription.model";
import { ReminderModel } from "../models/reminder.model";
import { DoseLogModel } from "../models/doseLog.model";
import { PrescriptionFeedbackModel } from "../models/PrescriptionFeedback.model";
import { OTP } from "../models/otp.model";
import { ShareLinkModel } from "../models/shareLink.model";
import { ClinicalNarrativeModel } from "../models/clinicalNarrative.model";
import { MedicalExpenseModel } from "../models/medicalExpense.model";
import { FamilyMemberModel } from "../models/familyMember.model";
import { MedicineTakenLogModel } from "../models/medicineTakenLog.model";
import { CareLinkModel } from "../models/careLink.model";
import { LabReportModel } from "../models/labReport.model";
import { AiUsageModel } from "../models/aiUsage.model";

export const requestEmailOtpService = async (email: string): Promise<void> => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error(MESSAGES.USER_EXISTS);
  }
  await sendEmailOTP(email);
};

export const signupWithEmailService = async (
  email: string,
  password: string,
  fullName: string,
  code: string,
  country?: string
): Promise<{ user: IUser; token: string }> => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error(MESSAGES.USER_EXISTS);
  }

  const isValid = await verifyEmailOTP(email, code);
  if (!isValid) {
    throw new Error(MESSAGES.INVALID_OTP);
  }

  const countryCode = (country || "BD").toUpperCase();
  const hashedPassword = await hashPassword(password);
  const user = await User.create({
    email,
    password: hashedPassword,
    fullName,
    isVerified: true,
    country: countryCode,
    currency: currencyForCountry(countryCode).currency,
    language: languageForCountry(countryCode),
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

  // Remove stored test report files
  await Promise.all(
    prescriptions.flatMap((p) => p.tests || []).map((t) => deleteReport(t.reportUrl))
  );

  const uid = user._id;
  await Promise.all([
    PrescriptionFeedbackModel.deleteMany({ userId: uid }),
    ReminderModel.deleteMany({ userId: uid }),
    DoseLogModel.deleteMany({ userId: uid }),
    MedicineTakenLogModel.deleteMany({ userId: uid }),
    PrescriptionModel.deleteMany({ userId: uid }),
    ShareLinkModel.deleteMany({ userId: uid }),
    ClinicalNarrativeModel.deleteMany({ userId: uid }),
    MedicalExpenseModel.deleteMany({ userId: uid }),
    FamilyMemberModel.deleteMany({ userId: uid }),
    LabReportModel.deleteMany({ userId: uid }),
    CareLinkModel.deleteMany({ $or: [{ patientId: uid }, { caregiverId: uid }] }),
    AiUsageModel.deleteMany({ scope: { $regex: `^u:${uid}:` } }),
    user.mobileNumber ? OTP.deleteMany({ mobileNumber: user.mobileNumber }) : Promise.resolve(),
  ]);

  // User document also holds device FCM tokens
  await User.deleteOne({ _id: user._id });
};
