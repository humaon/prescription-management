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
import { runAllReminders, runCleanupJobs } from "./jobs/reminderScheduler";

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
  res.json({ status: "OK" });
});

// Routes
app.use(`/auth`, authRoutes);
app.use(`${appConfig.BASE_PATH}/users`, userRoutes);
app.use(`${appConfig.BASE_PATH}/prescriptions`, prescriptionRoutes);
app.use(`${appConfig.BASE_PATH}/fcm`, fcmRoutes);
app.use("/test", testNotificationRoutes);

// Cloud Scheduler endpoints
app.post("/cron/run-reminders", async (_req, res) => {
  try {
    await runAllReminders();
    res.status(200).send("✅ Reminders executed");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Failed to run reminders");
  }
});

app.post("/cron/run-cleanup", async (_req, res) => {
  try {
    await runCleanupJobs();
    res.status(200).send("✅ Cleanup executed");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Failed to run cleanup");
  }
});

// Error handler
app.use(errorHandler);

export default app;
