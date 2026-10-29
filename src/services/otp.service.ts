import { appConfig } from "../config/app.config";
import { generateOTP } from "../lib/otp";
import { sendOtpEmail } from "../lib/mailer";
import { OTP } from "../models/otp.model";

const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function sendOTP(mobileNumber: string): Promise<string> {
  await OTP.deleteMany({ mobileNumber });

  const code = generateOTP(parseInt(appConfig.OTP_LENGTH));
  const expiresAt = new Date(
    Date.now() + parseInt(appConfig.OTP_EXPIRES_MIN) * 60 * 1000
  );

  await OTP.create({ mobileNumber, code, expiresAt, verified: false });

  console.log(`📱 OTP for ${mobileNumber}: ${code}`);
  return code;
}

export async function verifyOTP(mobileNumber: string, code: string) {
  const otp = await OTP.findOne({
    mobileNumber,
    verified: false,
    expiresAt: { $gt: new Date() },
  });
  if (!otp) return false;
  if (otp.attempts >= MAX_ATTEMPTS || otp.code !== code) {
    otp.attempts += 1;
    await otp.save();
    return false;
  }
  otp.verified = true;
  await otp.save();
  return true;
}

export async function sendEmailOTP(email: string): Promise<void> {
  const existing = await OTP.findOne({ email }).sort({ createdAt: -1 });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new Error("Please wait a minute before requesting another code");
  }

  await OTP.deleteMany({ email });

  const code = generateOTP(parseInt(appConfig.OTP_LENGTH));
  const expiresAt = new Date(
    Date.now() + parseInt(appConfig.OTP_EXPIRES_MIN) * 60 * 1000
  );

  await OTP.create({ email, code, expiresAt, verified: false });
  await sendOtpEmail(email, code);
}

export async function verifyEmailOTP(email: string, code: string): Promise<boolean> {
  const otp = await OTP.findOne({
    email,
    verified: false,
    expiresAt: { $gt: new Date() },
  });
  if (!otp) return false;
  if (otp.attempts >= MAX_ATTEMPTS || otp.code !== code) {
    otp.attempts += 1;
    await otp.save();
    return false;
  }
  await OTP.deleteMany({ email });
  return true;
}
