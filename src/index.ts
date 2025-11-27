import app from "./app";
import { runStartupTasks } from "./bootstrap/startup";
import { appConfig } from "./config/app.config";

const startServer = async () => {
  // Startup lifecycle
  await runStartupTasks();

  // Server listen
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
