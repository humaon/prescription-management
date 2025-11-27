import { appConfig } from "../config/app.config";

export const prescriptionParseService = async (text: string) => {
  const prompt = `You are a medical prescription parser. Extract and structure the following information from the prescription text. Return ONLY a valid JSON object with exactly these fields:

{
  "doctor": {
    "name": "full name if available",
    "specialization": "specialization if mentioned",
    "license_number": "license number if provided",
    "contact": "phone or email if available"
  },
  "patient": {
    "name": "full name if available",
    "age": "age if mentioned",
    "gender": "M/F if mentioned",
    "contact": "phone or email if available",
    "registration_number": "patient ID or registration if available"
  },
  "symptoms": ["list of symptoms or chief complaints"],
  "diagnosis": ["list of diagnoses"],
  "tests": [
    {
      "name": "test name",
      "type": "lab test type if identifiable"
    }
  ],
  "medicines": [
    {
      "name": "medicine name",
      "dosage": "dosage amount",
      "frequency": "how often to take",
      "duration": "how long to take",
      "instructions": "any special instructions"
    }
  ],
  "notes": "any additional notes or precautions"
}

If any field is not found in the text, use null for that field. Be thorough but accurate. Return ONLY the JSON object, no markdown, no extra text.

Prescription Text:
${text}`;

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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data: any = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error("Invalid response from Gemini API");
  }

  const responseText = data.candidates[0].content.parts[0].text;

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse structured data from prescription");
  }

  const parsedData = JSON.parse(jsonMatch[0]);
  return parsedData;
};
