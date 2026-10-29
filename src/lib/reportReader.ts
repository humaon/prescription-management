// Reads a lab report (image or PDF) with Gemini into structured results.
// The model only transcribes; whether a value is out of range is decided here.
import fs from "fs";
import { appConfig } from "../config/app.config";

export type ResultFlag = "high" | "low" | "normal" | null;

export interface LabResult {
  name: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  flag: ResultFlag;
}

export interface LabReport {
  results: LabResult[];
  summary: string | null;
}

const PROMPT = `You read medical lab / test reports (blood tests, urine, imaging reports, ECG) from Bangladesh.
Return ONLY JSON:
{
  "results": [
    { "name": "test parameter as written", "value": "result as written", "unit": "unit or null", "referenceRange": "reference / normal range as written or null", "labFlag": "H" | "L" | null }
  ],
  "summary": "one or two plain-language sentences for the patient on what the report shows, naming results outside the reference range; for imaging/ECG, the impression. No diagnosis or treatment advice."
}
Rules: copy names, values, units and ranges exactly as printed; labFlag only if the report itself marks it (H, L, High, Low, *, bold arrow); never invent results; skip patient details, lab address and signatures. If it is not a medical report, return {"results": [], "summary": null}.`;

const num = (s: string | null | undefined) => {
  const m = /-?\d+(?:\.\d+)?/.exec(String(s ?? "").replace(/,/g, ""));
  return m ? parseFloat(m[0]) : null;
};

/** high/low/normal from the printed range ("13.0 - 17.0", "< 200", "> 40"); else the lab's own flag */
export const flagFor = (value: string, range: string | null, labFlag: unknown): ResultFlag => {
  const v = num(value);
  const r = String(range ?? "").replace(/,/g, "");
  if (v !== null && r) {
    const between = /(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/.exec(r);
    if (between) {
      const lo = parseFloat(between[1]);
      const hi = parseFloat(between[2]);
      if (lo < hi) return v < lo ? "low" : v > hi ? "high" : "normal";
    }
    const upper = /(?:<|≤|up to|upto|below)\s*=?\s*(-?\d+(?:\.\d+)?)/i.exec(r);
    if (upper) return v > parseFloat(upper[1]) ? "high" : "normal";
    const lower = /(?:>|≥|above)\s*=?\s*(-?\d+(?:\.\d+)?)/i.exec(r);
    if (lower) return v < parseFloat(lower[1]) ? "low" : "normal";
  }
  const f = String(labFlag ?? "").trim().toLowerCase();
  if (f === "h" || f === "high") return "high";
  if (f === "l" || f === "low") return "low";
  return null;
};

export const readLabReport = async (filePath: string, mimeType: string): Promise<LabReport | null> => {
  const data = (await fs.promises.readFile(filePath)).toString("base64");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${appConfig.GEMINI_MODEL}:generateContent?key=${appConfig.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data } }, { text: PROMPT }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw new Error(`Gemini report read failed: ${response.status}`);
  }
  const body: any = await response.json();
  const text: string = (body.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
  const parsed = JSON.parse(/\{[\s\S]*\}/.exec(text)?.[0] ?? "{}");

  const results: LabResult[] = (Array.isArray(parsed.results) ? parsed.results : [])
    .filter((r: any) => r && typeof r.name === "string" && r.name.trim() && r.value != null && String(r.value).trim())
    .slice(0, 100)
    .map((r: any) => {
      const value = String(r.value).trim();
      const referenceRange = r.referenceRange ? String(r.referenceRange).trim() : null;
      return {
        name: r.name.trim(),
        value,
        unit: r.unit ? String(r.unit).trim() : null,
        referenceRange,
        flag: flagFor(value, referenceRange, r.labFlag),
      };
    });
  const summary = typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : null;
  return results.length || summary ? { results, summary } : null;
};
