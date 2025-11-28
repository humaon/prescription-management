export function generateOTP(length = 6): string {
  // simple numeric OTP
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

// You should replace this with Twilio/MessageBird/etc.
export async function sendOTPSms(mobile: string, otp: string) {
  console.log(`SEND SMS to ${mobile}: OTP=${otp}`);
  // Integrate real SMS provider here
  return true;
}
