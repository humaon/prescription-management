import { Request, Response } from "express";
import fs from "fs/promises";
import { extractTextFromImage } from "../lib/ocr";
import { createServiceError, createSuccessResponse } from "../lib/utils";
import {
  prescriptionCreateService,
  prescriptionGetAllService,
  prescriptionParseService,
} from "../services/prescription.service";
import mongoose from "mongoose";
import { PrescriptionModel } from "../models/prescription.model";

export const prescriptionUploadController = async (
  req: Request,
  res: Response
) => {
  if (!req.file) {
    throw createServiceError("No image file uploaded", 400);
  }

  const imagePath = req.file.path;
  const extractedText = await extractTextFromImage(imagePath);
  const parsedData = await prescriptionParseService(extractedText);

  await prescriptionCreateService({ ...parsedData, ocrText: extractedText });

  // Clean up uploaded file
  await fs.unlink(imagePath);

  res
    .status(201)
    .json(
      createSuccessResponse(parsedData, "Prescription parsed successfully")
    );
};

export const prescriptionGetAllController = async (
  _req: Request,
  res: Response
) => {
  const data = await prescriptionGetAllService();

  res.status(200).json(createSuccessResponse(data, "List of prescriptions"));
};

export const prescriptionGetByIdController = async (
  req: Request,
  res: Response
) => {
  const prescriptionId = req.params.id;

  // Validate Mongo ObjectId
  if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid prescription ID",
    });
  }

  // Find prescription owned by the user
  const prescription = await PrescriptionModel.findOne({
    _id: prescriptionId,
  }).lean();

  if (!prescription) {
    return res.status(404).json({
      success: false,
      message: "Prescription not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: prescription,
  });
};
