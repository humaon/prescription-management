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
  prescriptionGetDetailsController,
  prescriptionDeleteByIdController,
  togglePrescriptionStatusController,
  getPrescriptionStatsController,
  getHealthInsightsController,
  getPendingTestsController,
  completeTestController,
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
    // Accept images only
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"));
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

// Download clinical summary as PDF
router.get("/clinical-summary/pdf", downloadClinicalSummaryPDFController);
// Upload and parse prescription (returns parsed data for user to review)
router.post("/upload", upload.single("prescription"), prescriptionUploadController);

// ============================================
// PRESCRIPTION CRUD
// ============================================

// Save prescription after user reviews/edits the parsed data
router.post("/save", prescriptionSaveController);

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

// Mark test as completed and upload report
router.patch("/:prescriptionId/tests/:testId/complete", completeTestController);

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

// Get all prescriptions
router.get("/", prescriptionGetAllController);

// Get single prescription by ID (simple view)
router.get("/:id", prescriptionGetByIdController);

// Get prescription details (detailed view with reminders, tests, feedback)
router.get("/:id/details", prescriptionGetDetailsController);

// ============================================
// NEW ROUTES - TEST TRACKING (duplicate section from above)
// ============================================

// Get all pending tests for user
router.get("/tests/pending", getPendingTestsController);

// Get all completed tests for user
router.get("/tests/completed", getCompletedTestsController);

// Get test statistics
router.get("/tests/stats", getTestStatsController);

// Get all tests for a specific prescription
router.get("/:prescriptionId/tests", getPrescriptionTestsController);

// Mark test as completed and upload report
router.patch("/:prescriptionId/tests/:testId/complete", completeTestController);

// Cancel a test
router.patch("/:prescriptionId/tests/:testId/cancel", cancelTestController);

// Check if all tests are completed for a prescription
router.get("/:prescriptionId/tests/all-completed", checkAllTestsCompletedController);

// ============================================
// NEW ROUTES - PRESCRIPTION COMPLETION & FEEDBACK (duplicate section from above)
// ============================================

// Complete prescription with feedback survey
router.post("/:prescriptionId/complete", completePrescriptionController);

// Get feedback for a specific prescription
router.get("/:prescriptionId/feedback", getPrescriptionFeedbackController);

// Get clinical summary report


export default router;