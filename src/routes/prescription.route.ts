import express from "express";
import multer from "multer";
import { authenticate } from "../middleware/authenticate.middleware";
import {
  prescriptionUploadController,
  prescriptionSaveController,
  prescriptionUpdateController,
  prescriptionGetAllController,
  prescriptionGetCurrentController,
  getActiveMedicationsController,
  getUserRemindersController,
  prescriptionGetByIdController,
  prescriptionDeleteByIdController,
  togglePrescriptionStatusController,
  getPrescriptionStatsController,
} from "../controllers/prescription.controller";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Apply authentication to all routes
router.use(authenticate);

// Upload and parse prescription (returns parsed data for user to review)
router.post("/upload", upload.single("prescription"), prescriptionUploadController);

// Save prescription after user reviews/edits the parsed data
router.post("/save", prescriptionSaveController);

// Get prescription statistics
router.get("/stats", getPrescriptionStatsController);

// Get current prescriptions only
router.get("/current", prescriptionGetCurrentController);

// Get active medications
router.get("/active-medications", getActiveMedicationsController);

// Get user reminders
router.get("/reminders", getUserRemindersController);

// Get all prescriptions
router.get("/", prescriptionGetAllController);

// Get single prescription by ID
router.get("/:id", prescriptionGetByIdController);

// Update prescription by ID
router.put("/:id", prescriptionUpdateController);

// Delete prescription by ID
router.delete("/:id", prescriptionDeleteByIdController);

// Toggle prescription status (current/archived)
router.patch("/:id/toggle-status", togglePrescriptionStatusController);

export default router;