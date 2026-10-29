import { Router } from "express";
import { testSendReminder, testDirectToken } from "../controllers/notification.test.controller";

const router = Router();

// POST /test/notification  (userId based)
router.post("/notification", testSendReminder);

// POST /test/notification/direct  (raw FCM token)
router.post("/notification/direct", testDirectToken);

export default router;