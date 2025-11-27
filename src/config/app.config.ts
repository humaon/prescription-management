import dotenv from "dotenv";
import { getEnv } from "../lib/utils";

// Load environment variables
dotenv.config();

export const appConfig = (() => ({
  NODE_ENV: getEnv("NODE_ENV", "development"),
  PORT: getEnv("PORT", "5000"),
  BASE_PATH: getEnv("BASE_PATH", "/api"),
  GEMINI_API_KEY: getEnv("GEMINI_API_KEY"),
  UPLOAD_DIR: getEnv("UPLOAD_DIR", "uploads"),
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
}))();
