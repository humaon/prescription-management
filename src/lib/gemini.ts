import { appConfig } from "../config/app.config";


export interface GeminiImagePart {
  mimeType: string;
  base64: string;
}

export async function geminiJson<T = any>(
  prompt: string,
  image?: GeminiImagePart,
  timeoutMs = 45000
): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${appConfig.GEMINI_MODEL}:generateContent?key=${appConfig.GEMINI_API_KEY}`;

  const parts: any[] = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });

  const payload = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  // One retry for transient failures (network blips, 429, 5xx) so a hiccup does not
  // surface as a failed scan.
  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) break;
      lastError = new Error(`Gemini error: ${response.status}`);
    } catch (e) {
      lastError = e;
      response = undefined;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
  }

  if (!response) {
    throw new Error(
      `Could not reach the AI service. Please try again. (${(lastError as Error)?.message || "network error"})`
    );
  }
  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status} - ${await response.text()}`);
  }

  const data: any = await response.json();
  const text: string = ((data?.candidates?.[0]?.content?.parts || []) as any[])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (!match) throw new Error("Gemini returned no JSON");
  return JSON.parse(match[0]) as T;
}
