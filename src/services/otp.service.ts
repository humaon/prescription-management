import { appConfig } from "../config/app.config";
import { generateOTP } from "../lib/otp";
import { OTP } from "../models/otp.model";

export async function sendOTP(mobileNumber: string): Promise<string> {
  await OTP.deleteMany({ mobileNumber });

  const code = generateOTP();
  const expiresAt = new Date(
    Date.now() + parseInt(appConfig.OTP_EXPIRES_MIN) * 60 * 1000
  ); // 5 minutes

  const otp = await OTP.create({
    mobileNumber,
    code,
    expiresAt,
    verified: false,
  });

  console.log(`📱 OTP for ${mobileNumber}: ${code}`);

  return code;
}

export async function verifyOTP(mobileNumber: string, code: string) {
  const otp = await OTP.findOne({
    mobileNumber,
    code,
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!otp) return false;

  otp.verified = true;
  await otp.save();

  return true;
}
