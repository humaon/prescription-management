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

  // MongoDB
  MONGO_URI: getEnv("MONGO_URI"),

  // Firebase
  FIREBASE_PROJECT_ID: getEnv("FIREBASE_PROJECT_ID", "test-project"),
  FIREBASE_CLIENT_EMAIL: getEnv("FIREBASE_CLIENT_EMAIL", "test"),
  FIREBASE_PRIVATE_KEY: getEnv("FIREBASE_PRIVATE_KEY", "test"),

}))();
