import { Request, Response } from "express";
import fs from "fs/promises";
import mongoose from "mongoose";
import { extractTextFromImage } from "../lib/ocr";
import { createServiceError, createSuccessResponse } from "../lib/utils";
import {
  prescriptionParseService,
  prescriptionSaveService,
  prescriptionUpdateService,
  prescriptionGetAllService,
  prescriptionGetCurrentService,
  getActiveMedicationsService,
  prescriptionGetByIdService,
  prescriptionDeleteByIdService,
  togglePrescriptionCurrentStatus,
  getUserRemindersService,
  getPrescriptionStatsService,
   getHealthInsightsService,
   getPrescriptionDetailsService,
   getPendingTestsService,
   completeTestService,
   getCompletedTestsService,
   getPrescriptionTestsService,
   getClinicalSummaryService,
   areAllTestsCompletedService,
   cancelTestService,
   completePrescriptionService,
   getPrescriptionFeedback,
   getTestStatsService
} from "../services/prescription.service";

// Step 1: Upload and parse (returns data for user to review/edit)
export const prescriptionUploadController = async (
  req: Request,
  res: Response
) => {
  if (!req.file) {
    throw createServiceError("No image file uploaded", 400);
  }

  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const imagePath = req.file.path;

  try {
    // Extract text from image
    const extractedText = await extractTextFromImage(imagePath);

    // Parse prescription using Gemini (but don't save yet)
    const parsedData = await prescriptionParseService(extractedText);

    // Clean up uploaded file
    await fs.unlink(imagePath);

    // Return parsed data for user to review/edit
    res.status(200).json(
      createSuccessResponse(
        {
          ...parsedData,
          ocrText: extractedText,
        },
        "Prescription parsed successfully. Please review and save."
      )
    );
  } catch (error) {
    // Clean up file on error
    await fs.unlink(imagePath).catch(() => {});
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

  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    throw createServiceError("Invalid prescription ID", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(testId)) {
    throw createServiceError("Invalid test ID", 400);
  }

  // File path where it's stored on server
  const reportPath = `/uploads/test-reports/${req.file.filename}`;
  
  // Or use full URL if you want to return full path
  const reportUrl = `${req.protocol}://${req.get('host')}${reportPath}`;

  const result = await completeTestService(
    prescriptionId,
    testId,
    req.userId,
    {
      reportUrl: reportUrl, // Store relative path or full URL
      resultSummary,
      notes,
    }
  );

  res
    .status(200)
    .json(createSuccessResponse(result, "Test marked as completed"));
};;

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

// Get clinical summary report
export const getClinicalSummaryController = async (
  req: Request,
  res: Response
) => {
  if (!req.userId) {
    throw createServiceError("User not authenticated", 401);
  }

  const summary = await getClinicalSummaryService(req.userId);

  res
    .status(200)
    .json(
      createSuccessResponse(summary, "Clinical summary report generated")
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

  const summary = await getClinicalSummaryService(req.userId);

  res
    .status(200)
    .json(
      createSuccessResponse(
        {
          summary,
          message:
            "PDF generation coming soon. Use this data to generate PDF on frontend.",
        },
        "Clinical summary data retrieved for PDF generation"
      )
    );
};