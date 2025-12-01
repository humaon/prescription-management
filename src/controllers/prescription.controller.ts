import { Request, Response } from "express";
import fs from "fs/promises";
import { extractTextFromImage } from "../lib/ocr";
import { createServiceError, createSuccessResponse } from "../lib/utils";
import {
  prescriptionCreateService,
  prescriptionGetAllService,
  prescriptionParseService,
} from "../services/prescription.service";

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
