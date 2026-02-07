import fs from "fs";
import pdfParse from "pdf-parse-new";
import { visionClient } from "../config/vision.config";

export async function extractTextFromImage(imagePath: string): Promise<string> {
  if (!fs.existsSync(imagePath)) {
    throw new Error("File not found");
  }

  console.log("🔍 Running Google Vision DOCUMENT OCR...");
  const [result] = await visionClient.documentTextDetection(imagePath);

  const fullText =
    result.fullTextAnnotation?.text ||
    result.textAnnotations?.[0]?.description ||
    "";
  console.log(`✅ OCR complete — Text length: ${fullText.length}`);

  if (!fullText || fullText.trim().length < 20) {
    throw new Error("Insufficient text extracted from image");
  }

  return fullText;
}

export const extractTextFromPDF = async (filePath: string): Promise<string> => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  if (!data.text || data.text.trim().length < 20) {
    throw new Error("Insufficient text extracted from PDF");
  }

  return data.text;
};
