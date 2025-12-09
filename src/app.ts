import cors from "cors";
import "dotenv/config";
import express from "express";
import passport from "passport";
import { appConfig } from "./config/app.config";
import { setupPassport } from "./config/passport.config";
import { errorHandler } from "./middleware/errorHandler.middleware";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import prescriptionRoutes from "./routes/prescription.route";
import morgan from "morgan";
import fcmRoutes from "./routes/fcm.route";

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
  res.json({
    status: "OK",
  });
});

// Routes
app.use(`/auth`, authRoutes);
app.use(`${appConfig.BASE_PATH}/users`, userRoutes);
app.use(`${appConfig.BASE_PATH}/prescriptions`, prescriptionRoutes);
app.use(`${appConfig.BASE_PATH}/fcm`, fcmRoutes); 

// Error handler
app.use(errorHandler);

export default app;
