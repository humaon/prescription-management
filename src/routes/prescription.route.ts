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
  getReminderScheduleController,
  getAdherenceController,
  checkMedicinesController,
  createShareLinkController,
  listShareLinksController,
  revokeShareLinkController,
  setReminderStockController,
  getUpcomingFollowUpsController,
  setDoseTakenController,
  prescriptionGetByIdController,
  prescriptionGetDetailsController,
  prescriptionDeleteByIdController,
  togglePrescriptionStatusController,
  getPrescriptionStatsController,
  getHealthInsightsController,
  getPendingTestsController,
  completeTestController,
  getTestReportController,
  getPrescriptionTestsController,
  getCompletedTestsController,
  cancelTestController,
  checkAllTestsCompletedController,
  getTestStatsController,
  completePrescriptionController,
  getPrescriptionFeedbackController,

  downloadClinicalSummaryPDFController,
  getClinicalSummaryController,
} from "../controllers/prescription.controller";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf") {
      return cb(new Error("Only image or PDF files are allowed!"));
    }
    cb(null, true);
  },
});

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// PRESCRIPTION UPLOAD & PARSING
// ============================================
router.get("/clinical-summary", getClinicalSummaryController);

// Read-only summary links for a doctor
router.post("/share", createShareLinkController);
router.get("/share", listShareLinksController);
router.delete("/share/:id", revokeShareLinkController);

// Download clinical summary as PDF
router.get("/clinical-summary/pdf", downloadClinicalSummaryPDFController);
// Upload and parse prescription (returns parsed data for user to review)
// Up to 5 pages (images or PDFs) under the same field name
router.post("/upload", upload.array("prescription", 5), prescriptionUploadController);

// ============================================
// PRESCRIPTION CRUD
// ============================================

// Save prescription after user reviews/edits the parsed data
router.post("/save", prescriptionSaveController);

// Duplicate-medicine warnings before saving
router.post("/check-medicines", checkMedicinesController);

router.patch(
  "/:prescriptionId/tests/:testId/complete",
  upload.single("report"), // Field name is "report"
  completeTestController
);

// Update prescription by ID
router.put("/:id", prescriptionUpdateController);

// Delete prescription by ID
router.delete("/:id", prescriptionDeleteByIdController);

// Toggle prescription status (current/archived)
router.patch("/:id/toggle-status", togglePrescriptionStatusController);

// ============================================
// PRESCRIPTION COMPLETION & FEEDBACK
// ============================================

// Complete prescription with feedback survey
router.post("/:prescriptionId/complete", completePrescriptionController);

// Get feedback for a specific prescription
router.get("/:prescriptionId/feedback", getPrescriptionFeedbackController);

// ============================================
// CLINICAL SUMMARY
// ============================================



// ============================================
// TEST TRACKING ROUTES
// ============================================

// Get all pending tests for user
router.get("/tests/pending", getPendingTestsController);

// Get all completed tests for user
router.get("/tests/completed", getCompletedTestsController);

// Get test statistics
router.get("/tests/stats", getTestStatsController);

// Get all tests for a specific prescription
router.get("/:prescriptionId/tests", getPrescriptionTestsController);

// Download a test's report (owner only)
router.get("/:prescriptionId/tests/:testId/report", getTestReportController);

// Cancel a test
router.patch("/:prescriptionId/tests/:testId/cancel", cancelTestController);

// Check if all tests are completed for a prescription
router.get("/:prescriptionId/tests/all-completed", checkAllTestsCompletedController);

// ============================================
// STATISTICS & INSIGHTS
// ============================================

// Get health insights
router.get("/insights", getHealthInsightsController);

// Get prescription statistics
router.get("/stats", getPrescriptionStatsController);

// ============================================
// PRESCRIPTION RETRIEVAL
// ============================================

// Get current prescriptions only
router.get("/current", prescriptionGetCurrentController);

// Get active medications
router.get("/active-medications", getActiveMedicationsController);

// Get user reminders
router.get("/reminders", getUserRemindersController);

// All active reminders + dose times (the phone schedules local alarms from it)
router.get("/reminders/schedule", getReminderScheduleController);

// Doses taken vs due (?days=7)
router.get("/adherence", getAdherenceController);

// Upcoming follow-up visits
router.get("/follow-ups/upcoming", getUpcomingFollowUpsController);

// Mark (POST) / unmark (DELETE) today's dose for a reminder; body: { slot }
router.post("/reminders/:id/taken", setDoseTakenController);
router.delete("/reminders/:id/taken", setDoseTakenController);

// Units on hand for refill alerts; body: { count }
router.put("/reminders/:id/stock", setReminderStockController);

// Get all prescriptions
router.get("/", prescriptionGetAllController);

// Get single prescription by ID (simple view)
router.get("/:id", prescriptionGetByIdController);

// Get prescription details (detailed view with reminders, tests, feedback)
router.get("/:id/details", prescriptionGetDetailsController);

export default router;