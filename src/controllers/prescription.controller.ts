import { Request, Response } from "express";
import fs from "fs/promises";
import mongoose from "mongoose";
<<<<<<< HEAD
import { uploadToStorage } from "../lib/storage";
import { withAiQuota } from "../services/aiQuota.service";
=======
import { extractTextFromImage } from "../lib/ocr";
import { openReport, saveReport } from "../lib/reportStorage";
import { LabReport, readLabReport } from "../lib/reportReader";
import {
  createShareLinkService,
  listShareLinksService,
  revokeShareLinkService,
} from "../services/share.service";
>>>>>>> 64974c0da637dfad3a29f38640fbf82eabd20ed1
import { createServiceError, createSuccessResponse } from "../lib/utils";
import {
  prescriptionParseFromImageService,
  prescriptionSaveService,
  prescriptionUpdateService,
  prescriptionGetAllService,
  prescriptionGetCurrentService,
  getActiveMedicationsService,
  prescriptionGetByIdService,
  prescriptionDeleteByIdService,
  togglePrescriptionCurrentStatus,
  getUserRemindersService,
  getReminderScheduleService,
  getAdherenceService,
  checkMedicinesService,
  setReminderStockService,
  getUpcomingFollowUpsService,
  setDoseTakenService,
  getPrescriptionStatsService,
   getHealthInsightsService,
   getPrescriptionDetailsService,
   getPendingTestsService,
   completeTestService,
   getTestReportService,
   getCompletedTestsService,
   getPrescriptionTestsService,
   getClinicalSummaryService,
   areAllTestsCompletedService,
   cancelTestService,
   completePrescriptionService,
   getPrescriptionFeedback,
   getTestStatsService,
   getDetailedClinicalSummaryService,
   generateClinicalSummaryPDFService,
   getClinicalNarrativeService,
} from "../services/prescription.service";

// Step 1: Upload and parse (returns data for user to review/edit)
export const prescriptionUploadController = async (
  req: Request,
  res: Response
) => {
  const files = (Array.isArray(req.files) ? req.files : req.file ? [req.file] : []) as Express.Multer.File[];
  const cleanup = () => Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));

  if (files.length === 0) {
    throw createServiceError("No image file uploaded", 400);
  }

  if (!req.userId) {
    await cleanup();
    throw createServiceError("User not authenticated", 401);
  }

  try {
<<<<<<< HEAD
    // One Gemini call: read the photo and parse it (counts against the daily free scan limit)
    const { parsed, ocrText } = await withAiQuota(req.userId, "scan", () =>
      prescriptionParseFromImageService(imagePath)
    );
=======
    // Every page (image or PDF) is read in parallel, then parsed as one prescription
    const pages = await Promise.all(files.map((f) => extractTextFromImage(f.path, f.mimetype)));
    const extractedText =
      pages.length === 1 ? pages[0] : pages.map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");
>>>>>>> 64974c0da637dfad3a29f38640fbf82eabd20ed1

    // Keep the original photo (Cloudinary). Best-effort: the AI read already succeeded,
    // so a storage hiccup must not throw the result away.
    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadToStorage(imagePath, "prescriptions");
    } catch (e) {
      console.warn("⚠️ Prescription image storage failed, continuing without it:", e);
    }

<<<<<<< HEAD
    // Clean up local temp file
    await fs.unlink(imagePath);
=======
    await cleanup();
>>>>>>> 64974c0da637dfad3a29f38640fbf82eabd20ed1

    // Return parsed data for user to review/edit
    res.status(200).json(
      createSuccessResponse(
        {
          ...parsed,
          ocrText,
          imageUrl,
        },
        "Prescription parsed successfully. Please review and save."
      )
    );
  } catch (error) {
    await cleanup();
    throw error;
  }
};

// Step 2: Save prescription after user reviews/edits
export const prescriptionSaveController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const prescriptionData = req.body;

  // Validate required fields
  if (!prescriptionData.patient || !prescriptionData.medicines) {
    throw createServiceError("Missing required prescription data", 400);
  }

  // Save prescription and create reminders
  const savedPrescription = await prescriptionSaveService(
    prescriptionData,
    req.userId
  );

  res.status(201).json(
    createSuccessResponse(
      savedPrescription,
      "Prescription saved and reminders created successfully"
    )
  );
};

// Update existing prescription
export const prescriptionUpdateController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const { id } = req.params;
  const updateData = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  const updatedPrescription = await prescriptionUpdateService(
    id,
    req.userId,
    updateData
  );

  res.status(200).json(
    createSuccessResponse(
      updatedPrescription,
      "Prescription updated successfully"
    )
  );
};

// Get all prescriptions
export const prescriptionGetAllController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const prescriptions = await prescriptionGetAllService(req.userId);

  res
    .status(200)
    .json(
      createSuccessResponse(prescriptions, "All prescriptions retrieved")
    );
};

// Get only current prescriptions
export const prescriptionGetCurrentController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const prescriptions = await prescriptionGetCurrentService(req.userId);

  res
    .status(200)
    .json(createSuccessResponse(prescriptions, "Current prescriptions retrieved"));
};

// Get active medications
export const getActiveMedicationsController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const medications = await getActiveMedicationsService(req.userId);

  res
    .status(200)
    .json(createSuccessResponse(medications, "Active medications retrieved"));
};

// Get user's medication reminders
export const getUserRemindersController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const reminders = await getUserRemindersService(req.userId);

  res
    .status(200)
    .json(createSuccessResponse(reminders, "Medication reminders retrieved"));
};

// Get prescription by ID
export const prescriptionGetByIdController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const prescriptionId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  const prescription = await prescriptionGetByIdService(
    prescriptionId,
    req.userId
  );

  if (!prescription) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  res
    .status(200)
    .json(createSuccessResponse(prescription, "Prescription retrieved"));
};

// Delete prescription by ID
export const prescriptionDeleteByIdController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const prescriptionId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  const deletedPrescription = await prescriptionDeleteByIdService(
    prescriptionId,
    req.userId
  );

  if (!deletedPrescription) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  res
    .status(200)
    .json(
      createSuccessResponse(null, "Prescription deleted successfully")
    );
};

// Toggle prescription current/archived status
export const togglePrescriptionStatusController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const { id } = req.params;
  const { isCurrent } = req.body;

  if (typeof isCurrent !== "boolean") {
    throw createServiceError("isCurrent must be a boolean", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  const prescription = await togglePrescriptionCurrentStatus(
    id,
    req.userId,
    isCurrent
  );

  res.status(200).json(
    createSuccessResponse(
      prescription,
      `Prescription marked as ${isCurrent ? "current" : "archived"}${
        !isCurrent ? " and reminders deactivated" : " and reminders reactivated"
      }`
    )
  );
};

// Get prescription statistics
export const getPrescriptionStatsController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const stats = await getPrescriptionStatsService(req.userId);

  res
    .status(200)
    .json(createSuccessResponse(stats, "Prescription statistics retrieved"));
};
export const getHealthInsightsController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const insights = await getHealthInsightsService(req.userId);

  res
    .status(200)
    .json(
      createSuccessResponse(
        insights,
        "Health insights retrieved successfully"
      )
    );
}
// export const prescriptionGetByIdController = async (
//   req: Request,
//   res: Response
// ) => {
//   if (!req.userId) {
//     throw createServiceError("User not authenticated", 401);
//   }

//   const prescriptionId = req.params.id;

//   if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
//     throw createServiceError("Invalid prescription ID", 400);
//   }

//   const prescription = await prescriptionGetByIdService(
//     prescriptionId,
//     req.userId
//   );

//   if (!prescription) {
//     throw createServiceError("Prescription not found or access denied", 404);
//   }

//   res
//     .status(200)
//     .json(createSuccessResponse(prescription, "Prescription retrieved"));
// };

// NEW: Get prescription details (detailed view with related data)
export const prescriptionGetDetailsController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const prescriptionId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  const details = await getPrescriptionDetailsService(
    prescriptionId,
    req.userId
  );

  if (!details) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  res
    .status(200)
    .json(createSuccessResponse(details, "Prescription details retrieved"));
};
export const getPendingTestsController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const pendingTests = await getPendingTestsService(req.userId);

  res
    .status(200)
    .json(
      createSuccessResponse(
        pendingTests,
        `Found ${pendingTests.length} pending test(s)`
      )
    );
};

// Mark test as completed and upload report
export const completeTestController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const { prescriptionId, testId } = req.params;
  const { resultSummary, notes } = req.body;

  // Check if file was uploaded
  if (!req.file) {
    throw createServiceError("Test report file is required", 400);
  }

  if (
    !mongoose.Types.ObjectId.isValid(prescriptionId) ||
    !mongoose.Types.ObjectId.isValid(testId)
  ) {
    await fs.unlink(req.file.path).catch(() => {});
    throw createServiceError("Invalid prescription or test ID", 400);
  }

  // Best effort: the test is completed even if the report can't be read
  let report: LabReport | null = null;
  try {
    report = await readLabReport(req.file.path, req.file.mimetype);
  } catch (error) {
    console.error("❌ Lab report read failed:", error);
  }

<<<<<<< HEAD
  // Upload test report to Cloudinary
  const reportUrl = await uploadToStorage(req.file.path, "test-reports");

  // Clean up local temp file
  await fs.unlink(req.file.path).catch(() => {});
=======
  const reportKey = await saveReport(req.file.path, req.file.mimetype, req.userId);
>>>>>>> 64974c0da637dfad3a29f38640fbf82eabd20ed1

  const result = await completeTestService(prescriptionId, testId, req.userId, {
    reportKey,
    reportMimeType: req.file.mimetype,
    resultSummary,
    notes,
    results: report?.results ?? [],
    aiSummary: report?.summary ?? null,
  });

  res
    .status(200)
    .json(createSuccessResponse(result, "Test marked as completed"));
};

// Stream a test report to its owner (reports are never served publicly)
export const getTestReportController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  const { prescriptionId, testId } = req.params;
  if (
    !mongoose.Types.ObjectId.isValid(prescriptionId) ||
    !mongoose.Types.ObjectId.isValid(testId)
  ) {
    throw createServiceError("Invalid prescription or test ID", 400);
  }

  const { key, mimeType } = await getTestReportService(prescriptionId, testId, req.userId);
  const stream = openReport(key);
  if (!stream) {
    throw createServiceError("Report file is no longer available", 404);
  }
  res.setHeader("Content-Type", mimeType || "application/octet-stream");
  res.setHeader("Cache-Control", "private, no-store");
  stream.on("error", () => {
    if (!res.headersSent) res.status(404);
    res.end();
  });
  stream.pipe(res);
};

// Get all tests for a specific prescription
export const getPrescriptionTestsController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const { prescriptionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  const tests = await getPrescriptionTestsService(prescriptionId, req.userId);

  res.status(200).json(createSuccessResponse(tests, "Tests retrieved"));
};

// Get all completed tests for user
export const getCompletedTestsController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const completedTests = await getCompletedTestsService(req.userId);

  res
    .status(200)
    .json(
      createSuccessResponse(
        completedTests,
        `Found ${completedTests.length} completed test(s)`
      )
    );
};

// Cancel a test
export const cancelTestController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const { prescriptionId, testId } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(testId)) {
    throw createServiceError("Invalid test ID", 400);
  }

  const result = await cancelTestService(
    prescriptionId,
    testId,
    req.userId,
    reason
  );

  res.status(200).json(createSuccessResponse(result, "Test cancelled"));
};

// Check if all tests are completed for a prescription
export const checkAllTestsCompletedController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const { prescriptionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  const allCompleted = await areAllTestsCompletedService(
    prescriptionId,
    req.userId
  );

  res
    .status(200)
    .json(
      createSuccessResponse(
        { allCompleted },
        allCompleted
          ? "All tests completed"
          : "Some tests are still pending"
      )
    );
};

// Get test statistics for user
export const getTestStatsController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const stats = await getTestStatsService(req.userId);

  res
    .status(200)
    .json(createSuccessResponse(stats, "Test statistics retrieved"));
};

// ============================================
// NEW ENDPOINTS - PRESCRIPTION COMPLETION & FEEDBACK
// ============================================

// Complete prescription (submit feedback survey)
export const completePrescriptionController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const { prescriptionId } = req.params;
  const feedbackData = req.body;

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  console.log("Feedback Data Received:", feedbackData);
  // Validate required feedback fields
  const requiredFields = [
    "overallImprovement",
    "symptomRelief",
    "medicationEffectiveness",
    "sideEffects",
    "healthConditionNow",
    "wasHelpful",
    "wouldRecommend",
  ];

  for (const field of requiredFields) {
    if (feedbackData[field] === undefined || feedbackData[field] === null) {
      throw createServiceError(`Missing required field: ${field}`, 400);
    }
  }

  // Validate rating ranges (1-5)
  const ratingFields = [
    "overallImprovement",
    "symptomRelief",
    "medicationEffectiveness",
    "sideEffects",
  ];

  for (const field of ratingFields) {
    const value = feedbackData[field];
    if (typeof value !== "number" || value < 1 || value > 5) {
      throw createServiceError(`${field} must be a number between 1 and 5`, 400);
    }
  }

  // Validate boolean fields
  if (typeof feedbackData.wasHelpful !== "boolean") {
    throw createServiceError("wasHelpful must be a boolean", 400);
  }
  if (typeof feedbackData.wouldRecommend !== "boolean") {
    throw createServiceError("wouldRecommend must be a boolean", 400);
  }

  const result = await completePrescriptionService(
    prescriptionId,
    req.userId,
    feedbackData
  );

  res
    .status(200)
    .json(
      createSuccessResponse(
        result,
        "Prescription completed, reminders paused, and feedback submitted successfully"
      )
    );
};

// Get feedback for a specific prescription
export const getPrescriptionFeedbackController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const { prescriptionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  const feedback = await getPrescriptionFeedback(prescriptionId, req.userId);

  if (!feedback) {
    throw createServiceError("Feedback not found for this prescription", 404);
  }

  res
    .status(200)
    .json(createSuccessResponse(feedback, "Prescription feedback retrieved"));
};

export const getClinicalSummaryController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const summary = await getDetailedClinicalSummaryService(req.userId);
<<<<<<< HEAD

  // The AI narrative is a bonus: if the daily free limit is hit, still return the summary data
  let narrative: string | null = null;
  try {
    narrative = await withAiQuota(req.userId, "summary", () =>
      generateAIClinicalNarrativeService(req.userId!, summary)
    );
  } catch (e: any) {
    if (e?.statusCode !== 429 && e?.statusCode !== 503) throw e;
  }
=======
  const narrative = await getClinicalNarrativeService(req.userId, summary);
>>>>>>> 64974c0da637dfad3a29f38640fbf82eabd20ed1

  res
    .status(200)
    .json(
      createSuccessResponse(
        {
          ...summary,
          aiNarrative: narrative, // Add AI narrative to response
        },
        "Clinical summary generated successfully"
      )
    );
};

// Generate and download clinical summary as PDF
export const downloadClinicalSummaryPDFController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  try {
    const pdfBuffer = await generateClinicalSummaryPDFService(req.userId);
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=clinical-summary-${Date.now()}.pdf`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    throw error;
  }
};
// Mark / unmark one of today's doses as taken
export const setDoseTakenController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  const { slot } = req.body;
  if (!["morning", "noon", "night"].includes(slot)) {
    throw createServiceError("slot must be morning, noon or night", 400);
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw createServiceError("Invalid reminder ID", 400);
  }

  const result = await setDoseTakenService(
    req.userId,
    req.params.id,
    slot,
    req.method === "POST"
  );
  res.status(200).json(createSuccessResponse(result, "Dose updated"));
};


// All active reminders + dose times, for the phone's local alarms
export const getReminderScheduleController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  const schedule = await getReminderScheduleService(req.userId);
  res.status(200).json(createSuccessResponse(schedule, "Reminder schedule retrieved"));
};

// Warn before saving: medicines repeating ones already being taken
// body: { medicines: [...], excludePrescriptionId?: string }
export const checkMedicinesController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  const { medicines, excludePrescriptionId, allergies } = req.body ?? {};
  if (!Array.isArray(medicines)) {
    throw createServiceError("medicines must be an array", 400);
  }
  const warnings = await checkMedicinesService(
    req.userId,
    medicines.slice(0, 50),
    excludePrescriptionId,
    Array.isArray(allergies) ? allergies : []
  );
  res.status(200).json(createSuccessResponse({ warnings }, `${warnings.length} warning(s)`));
};

// Doses taken vs due; ?days=1..90 (default 7)
export const getAdherenceController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  const days = Math.min(Math.max(parseInt(String(req.query.days ?? "7"), 10) || 7, 1), 90);
  const adherence = await getAdherenceService(req.userId, days);
  res.status(200).json(createSuccessResponse(adherence, "Adherence retrieved"));
};

// body: { count: number | null } — units on hand (null stops tracking)
export const setReminderStockController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw createServiceError("Invalid reminder ID", 400);
  }
  const { count } = req.body ?? {};
  if (count !== null && (typeof count !== "number" || !isFinite(count) || count < 0 || count > 10000)) {
    throw createServiceError("count must be a number from 0 to 10000, or null", 400);
  }
  const result = await setReminderStockService(req.userId, req.params.id, count);
  res.status(200).json(createSuccessResponse(result, "Stock updated"));
};

// ---------- Doctor share links ----------
const publicBaseUrl = (req: Request) =>
  (process.env.PUBLIC_BASE_URL || `${req.get("x-forwarded-proto") || req.protocol}://${req.get("host")}`).replace(/\/$/, "");

// body: { days?: 1..30 } (default 7)
export const createShareLinkController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  const days = Math.min(Math.max(parseInt(String(req.body?.days ?? "7"), 10) || 7, 1), 30);
  const link = await createShareLinkService(req.userId, req.profileId ?? null, days);
  res.status(201).json(
    createSuccessResponse(
      { id: link.id, url: `${publicBaseUrl(req)}/share/${link.token}`, expiresAt: link.expiresAt },
      "Share link created"
    )
  );
};

export const listShareLinksController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  const links = await listShareLinksService(req.userId, req.profileId ?? null);
  res.status(200).json(createSuccessResponse(links, "Active share links"));
};

export const revokeShareLinkController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw createServiceError("Invalid share link ID", 400);
  }
  await revokeShareLinkService(req.userId, req.params.id);
  res.status(200).json(createSuccessResponse(null, "Share link stopped"));
};

// Upcoming follow-up visits (date >= today), soonest first
export const getUpcomingFollowUpsController = async (req: Request, res: Response) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }
  const followUps = await getUpcomingFollowUpsService(req.userId);
  res.status(200).json(createSuccessResponse(followUps, "Upcoming follow-ups retrieved"));
};
