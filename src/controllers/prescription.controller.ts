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
   getHealthInsightsService
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