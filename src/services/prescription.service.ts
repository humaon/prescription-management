import { appConfig } from "../config/app.config";
import { getPrompt } from "../lib/prompt";
import {
  IPrescriptionDocument,
  PrescriptionModel,
} from "../models/prescription.model";
import {
  ParsedPrescription,
  validatePrescriptionParsedData,
} from "../validation/prescription.validation";

export const prescriptionParseService = async (text: string) => {
  if (!text || text.trim().length === 0) {
    throw new Error("Prescription text is empty");
  }

  const prompt = getPrompt(text);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${appConfig.GEMINI_API_KEY}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Gemini API error: ${response.status} - ${error || response.statusText}`
      );
    }

    const data: any = await response.json();

    // Validate Gemini response structure
    if (
      !data.candidates ||
      !Array.isArray(data.candidates) ||
      !data.candidates[0]
    ) {
      throw new Error(
        "Invalid response structure from Gemini API: no candidates"
      );
    }

    if (!data.candidates[0].content || !data.candidates[0].content.parts) {
      throw new Error("Invalid response structure from Gemini API: no content");
    }

    const responseText = data.candidates[0].content.parts[0].text;

    if (!responseText || typeof responseText !== "string") {
      throw new Error("Gemini API returned empty or invalid text");
    }

    // Extract JSON from response (handles markdown code blocks and extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        "Could not parse JSON from prescription text. Response: " +
          responseText.substring(0, 200)
      );
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      throw new Error(
        `Failed to parse JSON: ${
          parseError instanceof Error ? parseError.message : "Unknown error"
        }`
      );
    }

    // Validate parsed data structure
    if (!validatePrescriptionParsedData(parsedData)) {
      throw new Error("Parsed data does not match required schema");
    }

    // Additional validation: ensure medicines array has valid entries
    if (parsedData.medicines.length > 0) {
      parsedData.medicines = parsedData.medicines.filter(
        (med: any) => med.name && med.name.trim().length > 0
      );
    }

    // Ensure no duplicate symptoms/diagnosis
    parsedData.symptoms = [...new Set(parsedData.symptoms.filter(Boolean))];
    parsedData.diagnosis = [...new Set(parsedData.diagnosis.filter(Boolean))];

    return parsedData as ParsedPrescription;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Prescription parsing failed: ${error.message}`);
    }
    throw new Error("Prescription parsing failed: Unknown error");
  }
};

export const prescriptionCreateService = async (
  data: Partial<IPrescriptionDocument>
) => {
  const prescription = new PrescriptionModel({
    ...data,
    processingStatus: "pending",
    uploadedAt: new Date(),
  });

  const saved = await prescription.save();
  return saved;
};

export const prescriptionGetAllService = async () => {
  const prescriptions = await PrescriptionModel.find({});
  return prescriptions;
};
