import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { appConfig } from "./config/app.config";
import { errorHandler } from "./middleware/errorHandler.middleware";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const BASE_PATH = appConfig.BASE_PATH;
const app = express();

app.use(express.json());

app.get(`${BASE_PATH}/health`, (_req: Request, res: Response) => {
  res.json({
    status: "OK",
    message: "Medical Prescription Parser Service Running",
  });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(
    `Prescription management service is running on port ${appConfig.PORT}`
  );
  console.log(`Environment: ${appConfig.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/${BASE_PATH}/health`);
});
