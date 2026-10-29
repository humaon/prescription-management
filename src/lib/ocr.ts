import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse-new";
<<<<<<< HEAD
=======
import { appConfig } from "../config/app.config";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
};

const OCR_PROMPT = `You are an OCR engine. Transcribe ALL text visible in this medical prescription (image or PDF) exactly as written, including handwritten text.
- Preserve the original line breaks and reading order.
- Keep medicine names, strengths, dosage patterns (e.g. 1+0+1), durations and instructions exactly as written; do not correct or expand them.
- Keep Bangla text in Bangla; do not translate.
- Output only the transcribed text, with no commentary or markdown.`;

export async function extractTextFromImage(
  imagePath: string,
  mimeType?: string
): Promise<string> {
  if (!fs.existsSync(imagePath)) {
    throw new Error("File not found");
  }

  const type =
    mimeType || MIME_BY_EXT[path.extname(imagePath).toLowerCase()] || "image/jpeg";
  const data = (await fs.promises.readFile(imagePath)).toString("base64");

  console.log(`🔍 Running Gemini OCR (${appConfig.GEMINI_MODEL})...`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${appConfig.GEMINI_MODEL}:generateContent?key=${appConfig.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ inline_data: { mime_type: type, data } }, { text: OCR_PROMPT }],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini OCR error: ${response.status} - ${error || response.statusText}`);
  }

  const result: any = await response.json();
  const fullText: string = (result.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p.text || "")
    .join("")
    .trim();
  console.log(`✅ OCR complete — Text length: ${fullText.length}`);

  if (!fullText || fullText.trim().length < 20) {
    throw new Error("Insufficient text extracted from image");
  }

  return fullText;
}
>>>>>>> 64974c0da637dfad3a29f38640fbf82eabd20ed1

export const extractTextFromPDF = async (filePath: string): Promise<string> => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  if (!data.text || data.text.trim().length < 20) {
    throw new Error("Insufficient text extracted from PDF");
  }

  return data.text;
};
