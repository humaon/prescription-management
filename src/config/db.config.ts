import mongoose from "mongoose";
import { appConfig } from "./app.config";

export const connectDatabase = async (): Promise<void> => {
  try {
    console.log("✅ Database Connecting...");
    const uri = appConfig.MONGO_URI;
    await mongoose.connect(uri);
    console.log("✅ Database connected");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log("✅ Database disconnected");
  } catch (err) {
    console.error("❌ Database disconnection failed:", err);
  }
};
