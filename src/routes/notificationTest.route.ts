import { Router } from "express";
import { testSendReminder } from "../controllers/notification.test.controller";

const router = Router();

// POST /test/notification
router.post("/notification", testSendReminder);

export default router;