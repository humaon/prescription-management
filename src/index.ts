import app from "./app";
import { runStartupTasks } from "./bootstrap/startup";
import { appConfig } from "./config/app.config";
import { connectDatabase } from "./config/db.config";
import { initializeReminderSchedulers } from "../src/jobs/reminderScheduler";
import { initializeFirebase } from "./services/notification.service";

const startServer = async () => {
  // Startup lifecycle
  await runStartupTasks();

  // Database connection
  await connectDatabase();
   try {
    initializeFirebase();
    console.log("✅ Firebase initialized for push notifications");
  } catch (error) {
    console.error("⚠️  Firebase initialization failed:", error);
    console.log("   App will continue without push notifications");
  }
  initializeReminderSchedulers();


  app.listen(appConfig.PORT, () => {
    console.log(
      `Prescription management service is running on port ${appConfig.PORT}`
    );
    console.log(`Environment: ${appConfig.NODE_ENV}`);
    console.log(
      `Health check: http://localhost:${appConfig.PORT}${appConfig.BASE_PATH}/health`
    );
  });
};

startServer().catch((err) => {
  console.error("❌ Application failed to start:", err);
  process.exit(1);
});
