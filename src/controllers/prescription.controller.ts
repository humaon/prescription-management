import { Request, Response } from "express";
import fs from "fs/promises";
import Tesseract from "tesseract.js";
import { createErrorResponse, createSuccessResponse } from "../lib/utils";
import { prescriptionParseWithGemini } from "../services/prescription.service";

export const prescriptionCreateController = async (
  req: Request,
  res: Response
) => {
  if (!req.file) {
    return res.status(400).json(createErrorResponse("No image file uploaded"));
  }

  const imagePath = req.file.path;
  const ocrResult = await Tesseract.recognize(imagePath, "eng");

  const extractedText = ocrResult.data.text;
  const parsedData = await prescriptionParseWithGemini(extractedText);

  // Clean up uploaded file
  await fs.unlink(imagePath);

  res
    .status(201)
    .json(
      createSuccessResponse(parsedData, "Prescription parsed successfully")
    );
};
