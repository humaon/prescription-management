import fs from "fs";
import pdfParse from "pdf-parse-new";
import Tesseract from "tesseract.js";

export const extractTextFromImage = async (
  imagePath: string
): Promise<string> => {
  const result = await Tesseract.recognize(imagePath, "eng");

  const text = result.data.text;
  if (!text || text.trim().length < 20) {
    throw new Error("Insufficient text extracted from image");
  }

  return text;
};

export const extractTextFromPDF = async (filePath: string): Promise<string> => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  if (!data.text || data.text.trim().length < 20) {
    throw new Error("Insufficient text extracted from PDF");
  }

  return data.text;
};
