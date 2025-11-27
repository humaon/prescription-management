import { Request, Response } from "express";
import fs from "fs/promises";
import { extractText } from "../lib/ocr";
import { createServiceError, createSuccessResponse } from "../lib/utils";
import { prescriptionParseService } from "../services/prescription.service";

export const prescriptionUploadController = async (
  req: Request,
  res: Response
) => {
  if (!req.file) {
    throw createServiceError("No image file uploaded", 400);
  }

  const imagePath = req.file.path;
  const extractedText = await extractText(imagePath);
  const parsedData = await prescriptionParseService(extractedText);

  // Clean up uploaded file
  await fs.unlink(imagePath);

  res
    .status(201)
    .json(
      createSuccessResponse(parsedData, "Prescription parsed successfully")
    );
};
