import { MESSAGES } from "../lib/constants";
import { signToken } from "../lib/jwt";
import { comparePassword, hashPassword } from "../lib/password";
import { IUser, User } from "../models/user.model";
import { currencyForCountry, languageForCountry } from "../lib/currency";
import { sendEmailOTP, sendOTP, verifyEmailOTP, verifyOTP } from "./otp.service";

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
