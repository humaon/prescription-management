import nodemailer, { Transporter } from "nodemailer";
import { appConfig } from "../config/app.config";

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: appConfig.SMTP_HOST,
    port: parseInt(appConfig.SMTP_PORT),
    secure: parseInt(appConfig.SMTP_PORT) === 465,
    auth: { user: appConfig.SMTP_USER, pass: appConfig.SMTP_PASS },
  });
  return transporter;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!appConfig.SMTP_USER || !appConfig.SMTP_PASS) {
    if (appConfig.NODE_ENV === "production") {
      throw new Error("Email service is not configured");
    }
    console.warn(`⚠️  SMTP not configured — dev OTP for ${to}: ${code}`);
    return;
  }

  await getTransporter().sendMail({
    from: appConfig.SMTP_FROM || `MediCare <${appConfig.SMTP_USER}>`,
    to,
    subject: `${code} is your MediCare verification code`,
    text: `Your MediCare verification code is ${code}. It expires in ${appConfig.OTP_EXPIRES_MIN} minutes. If you did not request this, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto">
      <h2 style="color:#2e7d32">MediCare</h2>
      <p>Your verification code:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p>
      <p style="color:#666">Expires in ${appConfig.OTP_EXPIRES_MIN} minutes. If you did not request this, ignore this email.</p>
    </div>`,
  });
}
