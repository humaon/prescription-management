import fs from "fs";
import pdfParse from "pdf-parse-new";

export const extractTextFromPDF = async (filePath: string): Promise<string> => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  if (!data.text || data.text.trim().length < 20) {
    throw new Error("Insufficient text extracted from PDF");
  }

  return data.text;
};
