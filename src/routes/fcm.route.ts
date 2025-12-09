// CREATE NEW FILE: src/routes/fcm.routes.ts

import express from "express";
import { authenticate } from "../middleware/authenticate.middleware";
import {
  registerFCMTokenController,
  removeFCMTokenController,
  updateNotificationSettingsController,
  getNotificationSettingsController,
} from "../controllers/fcm.controller";

const router = express.Router();

router.use(authenticate);

router.post("/register", registerFCMTokenController);
router.delete("/remove", removeFCMTokenController);
router.put("/settings", updateNotificationSettingsController);
router.get("/settings", getNotificationSettingsController);

export default router;