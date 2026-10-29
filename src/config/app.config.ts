import dotenv from "dotenv";
import { getEnv } from "../lib/utils";

// Load environment variables
dotenv.config();

export const appConfig = (() => ({
  NODE_ENV: getEnv("NODE_ENV", "development"),
  PORT: getEnv("PORT", "8080"),
  BASE_PATH: getEnv("BASE_PATH", "/api"),
  GEMINI_API_KEY: getEnv("GEMINI_API_KEY"),
  GEMINI_MODEL: getEnv("GEMINI_MODEL", "gemini-2.5-flash"),
  CRON_SECRET: process.env.CRON_SECRET || "",
  // Day boundaries for "today's doses" are computed in this timezone
  APP_TIMEZONE: getEnv("APP_TIMEZONE", "Asia/Dhaka"),

  // Upload
  UPLOAD_DIR: getEnv("UPLOAD_DIR", "uploads"),
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  // Firebase/Cloud Storage bucket for test reports; empty = local UPLOAD_DIR
  // (Cloud Run's disk is wiped on restart, so set this in production)
  REPORTS_BUCKET: process.env.REPORTS_BUCKET || "",

  // JWT
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "7d"),

  // OTP
  OTP_LENGTH: getEnv("OTP_LENGTH", "6"),
  OTP_EXPIRES_MIN: getEnv("OTP_EXPIRES_MIN", "5"),

  // Google OAuth
  GOOGLE_CLIENT_ID: getEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: getEnv("GOOGLE_CLIENT_SECRET"),
  GOOGLE_CALLBACK_URL: getEnv("GOOGLE_CALLBACK_URL"),

  // SMTP (Gmail app password or any SMTP)
  SMTP_HOST: getEnv("SMTP_HOST", "smtp.gmail.com"),
  SMTP_PORT: getEnv("SMTP_PORT", "465"),
  SMTP_USER: getEnv("SMTP_USER", ""),
  SMTP_PASS: getEnv("SMTP_PASS", ""),
  SMTP_FROM: getEnv("SMTP_FROM", ""),

  // MongoDB
  MONGO_URI: getEnv("MONGO_URI"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: getEnv("CLOUDINARY_CLOUD_NAME", ""),
  CLOUDINARY_API_KEY: getEnv("CLOUDINARY_API_KEY", ""),
  CLOUDINARY_API_SECRET: getEnv("CLOUDINARY_API_SECRET", ""),

  // Firebase
  FIREBASE_PROJECT_ID: getEnv("FIREBASE_PROJECT_ID", "test-project"),
  FIREBASE_CLIENT_EMAIL: getEnv("FIREBASE_CLIENT_EMAIL", "test"),
  FIREBASE_PRIVATE_KEY: getEnv("FIREBASE_PRIVATE_KEY", "test"),

  // Cloud Vision
  GOOGLE_APPLICATION_CREDENTIALS: getEnv("GOOGLE_APPLICATION_CREDENTIALS", ""),
}))();
