import cors from "cors";
import "dotenv/config";
import express from "express";
import { appConfig } from "./config/app.config";
import { errorHandler } from "./middleware/errorHandler.middleware";
import prescriptionRoutes from "./routes/prescription.route";

const app = express();

app.use(cors());
app.use(express.json());

app.get(`${appConfig.BASE_PATH}/health`, (_req, res) => {
  res.json({
    status: "OK",
  });
});

// API routes
app.use(`${appConfig.BASE_PATH}/prescriptions`, prescriptionRoutes);

// Error handler
app.use(errorHandler);

export default app;
