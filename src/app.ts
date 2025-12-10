// src/app.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import passport from "passport";
import { appConfig } from "./config/app.config";
import { setupPassport } from "./config/passport.config";
import { errorHandler } from "./middleware/errorHandler.middleware";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import prescriptionRoutes from "./routes/prescription.route";
import fcmRoutes from "./routes/fcm.route";
import testNotificationRoutes from "./routes/notificationTest.route";
import { runRemindersForTimeSlot, runCleanupJobs } from "./jobs/reminderScheduler";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Passport
setupPassport();
app.use(passport.initialize());

// Health check
app.get(`${appConfig.BASE_PATH}/health`, (_req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Routes
app.use(`/auth`, authRoutes);
app.use(`${appConfig.BASE_PATH}/users`, userRoutes);
app.use(`${appConfig.BASE_PATH}/prescriptions`, prescriptionRoutes);
app.use(`${appConfig.BASE_PATH}/fcm`, fcmRoutes);
app.use("/test", testNotificationRoutes);

// Cloud Scheduler endpoints - Morning reminders (8:00 AM)
app.post("/cron/reminders/morning", async (_req, res) => {
  try {
    console.log("🌅 Morning reminder cron triggered");
    const count = await runRemindersForTimeSlot("morning");
    res.status(200).json({ 
      success: true, 
      timeSlot: "morning", 
      count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Morning reminder error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to run morning reminders",
      timestamp: new Date().toISOString()
    });
  }
});

// Cloud Scheduler endpoints - Noon reminders (1:00 PM)
app.post("/cron/reminders/noon", async (_req, res) => {
  try {
    console.log("☀️ Noon reminder cron triggered");
    const count = await runRemindersForTimeSlot("noon");
    res.status(200).json({ 
      success: true, 
      timeSlot: "noon", 
      count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Noon reminder error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to run noon reminders",
      timestamp: new Date().toISOString()
    });
  }
});

// Cloud Scheduler endpoints - Night reminders (8:00 PM)
app.post("/cron/reminders/night", async (_req, res) => {
  try {
    console.log("🌙 Night reminder cron triggered");
    const count = await runRemindersForTimeSlot("night");
    res.status(200).json({ 
      success: true, 
      timeSlot: "night", 
      count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Night reminder error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to run night reminders",
      timestamp: new Date().toISOString()
    });
  }
});

// Cloud Scheduler endpoint - Cleanup job (runs daily)
app.post("/cron/cleanup", async (_req, res) => {
  try {
    console.log("🧹 Cleanup cron triggered");
    const result = await runCleanupJobs();
    res.status(200).json({ 
      success: true, 
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("❌ Cleanup error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to run cleanup",
      timestamp: new Date().toISOString()
    });
  }
});

// Error handler
app.use(errorHandler);

export default app;