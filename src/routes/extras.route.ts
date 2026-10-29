import { Router } from "express";
import multer from "multer";
import {
  acceptCareLink,
  checkInteractions,
  getEmergencyCard,
  getLabTrend,
  getUsage,
  claimReward,
  getPatientToday,
  getVisitCard,
  inviteCaregiver,
  listCareLinks,
  listLabReports,
  removeCareLink,
  runMissedDoseCron,
  updateEmergencyCard,
  updatePreferences,
  uploadLabReport,
} from "../controllers/extras.controller";
import { authenticate } from "../middleware/authenticate.middleware";

const router = Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Only image files are allowed!")),
});

// Caregivers
router.post("/caregivers/invite", authenticate, inviteCaregiver);
router.get("/caregivers", authenticate, listCareLinks);
router.post("/caregivers/:id/accept", authenticate, acceptCareLink);
router.delete("/caregivers/:id", authenticate, removeCareLink);
router.get("/caregivers/patients/:patientId/today", authenticate, getPatientToday);

// Lab reports
router.post("/lab-reports", authenticate, upload.single("report"), uploadLabReport);
router.get("/lab-reports", authenticate, listLabReports);
router.get("/lab-reports/trend", authenticate, getLabTrend);

// Safety + sharing
router.get("/medicines/interactions", authenticate, checkInteractions);
router.get("/visit-card", authenticate, getVisitCard);

// AI free-tier usage
router.get("/ai/usage", authenticate, getUsage);
router.post("/ai/reward", authenticate, claimReward);

// Profile
router.get("/emergency-card", authenticate, getEmergencyCard);
router.put("/emergency-card", authenticate, updateEmergencyCard);
router.put("/me/preferences", authenticate, updatePreferences);

// Cron (cron-job.org, ~45 min after the matching reminder cron)
router.post("/cron/missed-doses/:slot", runMissedDoseCron);

export default router;
