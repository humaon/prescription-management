import "dotenv/config";
import express from "express";
import { runStartupTasks } from "./bootstrap/startup";
import { appConfig } from "./config/app.config";
import { errorHandler } from "./middleware/errorHandler.middleware";
import prescriptionRoutes from "./routes/prescription.route";

export async function startServer() {
  // ✅ startup lifecycle
  await runStartupTasks();

  const BASE_PATH = appConfig.BASE_PATH;

  const app = express();
  app.use(express.json());

  app.get(`${appConfig.BASE_PATH}/health`, (_req, res) => {
    res.json({ status: "OK" });
  });

  app.use(`${appConfig.BASE_PATH}/prescriptions`, prescriptionRoutes);

  app.use(errorHandler);

  app.listen(appConfig.PORT, () => {
    console.log(
      `Prescription management service is running on port ${appConfig.PORT}`
    );
    console.log(`Environment: ${appConfig.NODE_ENV}`);
    console.log(
      `Health check: http://localhost:${appConfig.PORT}${BASE_PATH}/health`
    );
  });
}
