import fs from "fs";
import path from "path";
import { Types } from "mongoose";
import { geminiJson } from "../lib/gemini";
import { currencyForCountry, languageForCountry } from "../lib/currency";
import { uploadToStorage } from "../lib/storage";
import { LabReportModel, ILabResult } from "../models/labReport.model";
import { PrescriptionModel } from "../models/prescription.model";
import { User } from "../models/user.model";
import { getAdherenceService } from "./features.service";
import { withAiQuota } from "./aiQuota.service";
import { TtlCache } from "../lib/ttlCache";

const interactionCache = new TtlCache<{ interactions: any[]; duplicateTherapies: any[] }>(
  12 * 60 * 60 * 1000
);

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// ───────────── Lab report reader ─────────────

export const analyzeLabReportService = async (
  userId: string,
  filePath: string,
  familyMemberId?: string
) => {
  const base64 = fs.readFileSync(filePath).toString("base64");
  const mimeType = MIME[path.extname(filePath).toLowerCase()] || "image/jpeg";

  const prompt = `You are reading a medical lab report image (blood test, urine test, etc).
Extract ONLY values that are clearly printed on the report. Never invent or estimate a value.
For "status", compare the value with the reference range PRINTED ON THE REPORT:
"normal", "high", "low", or "unknown" if no range is printed.
If the image is not a lab report or is unreadable, return an empty results array.

Return JSON exactly like:
{
  "reportDate": "YYYY-MM-DD or null",
  "results": [
    {"name": "HbA1c", "value": 7.1, "valueText": "7.1", "unit": "%", "referenceRange": "4.0-5.6", "status": "high"}
  ],
  "summaryBn": "২-৩ বাক্যে সহজ বাংলায়: কোন মান স্বাভাবিকের বাইরে। রোগ নির্ণয় করবে না, শুধু doctor-এর সাথে কথা বলতে বলবে।",
  "summaryEn": "Same summary in simple English. No diagnosis; advise discussing with the doctor."
}
"value" must be a number or null (e.g. for "Positive"); put the raw text in "valueText".`;

  const ai = await withAiQuota(userId, "lab", () =>
    geminiJson<{
      reportDate: string | null;
      results: ILabResult[];
      summaryBn: string;
      summaryEn: string;
    }>(prompt, { mimeType, base64 })
  );

  if (!ai.results || ai.results.length === 0) {
    throw new Error("Could not read any test values from this image. Please upload a clearer photo of the report.");
  }

  let imageUrl = "";
  try {
    imageUrl = await uploadToStorage(filePath, "test-reports");
  } catch (e) {
    console.warn("⚠️ Lab report image storage failed, saving results without it:", e);
  }
  const parsedDate = ai.reportDate ? new Date(ai.reportDate) : new Date();

  return LabReportModel.create({
    userId: new Types.ObjectId(userId),
    familyMemberId: familyMemberId ? new Types.ObjectId(familyMemberId) : null,
    imageUrl,
    reportDate: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    results: ai.results,
    summaryBn: ai.summaryBn || "",
    summaryEn: ai.summaryEn || "",
  });
};

export const listLabReportsService = async (userId: string) =>
  LabReportModel.find({ userId: new Types.ObjectId(userId) }).sort({ reportDate: -1 }).limit(50);

export const getLabTrendService = async (userId: string, testName: string) => {
  const escaped = testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reports = await LabReportModel.find({
    userId: new Types.ObjectId(userId),
    "results.name": { $regex: escaped, $options: "i" },
  }).sort({ reportDate: 1 });

  const re = new RegExp(escaped, "i");
  const series = reports.flatMap((r) =>
    r.results
      .filter((x) => re.test(x.name) && x.value !== null)
      .map((x) => ({
        date: r.reportDate,
        value: x.value as number,
        unit: x.unit,
        status: x.status,
        referenceRange: x.referenceRange,
      }))
  );

  let change: { from: number; to: number; direction: "up" | "down" | "same" } | null = null;
  if (series.length >= 2) {
    const from = series[0].value;
    const to = series[series.length - 1].value;
    change = { from, to, direction: to > from ? "up" : to < from ? "down" : "same" };
  }

  return { test: testName, points: series.length, series, change };
};

// ───────────── Active medicines + interaction check ─────────────

export const getActiveMedicinesService = async (userId: string, familyMemberId?: string) => {
  const query: any = {
    userId: new Types.ObjectId(userId),
    status: "confirmed",
    isCurrent: true,
    isComplete: false,
  };
  if (familyMemberId) query.familyMemberId = new Types.ObjectId(familyMemberId);

  const prescriptions = await PrescriptionModel.find(query).lean();
  return prescriptions.flatMap((p) =>
    p.medicines.map((m) => ({
      name: m.name,
      dosage: m.dosage || null,
      frequency: m.frequency || null,
      duration: m.duration || null,
      doctor: p.doctor?.name || null,
      prescriptionId: p._id,
    }))
  );
};

export const checkInteractionsService = async (
  userId: string,
  familyMemberId?: string,
  extra: string[] = []
) => {
  const active = await getActiveMedicinesService(userId, familyMemberId);
  const list = [
    ...active.map((m) => ({ name: m.name, doctor: m.doctor })),
    ...extra.map((name) => ({ name, doctor: "user-entered" })),
  ];

  const disclaimer =
    "এটি শুধু সতর্কতামূলক তথ্য, চিকিৎসকের পরামর্শের বিকল্প নয়। ওষুধ বন্ধ বা পরিবর্তনের আগে doctor বা pharmacist-এর সাথে কথা বলুন। / Informational only, not medical advice. Consult your doctor or pharmacist before changing any medicine.";

  if (list.length < 2) {
    return { medicines: list, interactions: [], duplicateTherapies: [], disclaimer };
  }

  const prompt = `You are a clinical pharmacist. Review this patient's medicine list (brand names may be Bangladeshi/Indian brands; identify the active ingredients first).
Medicines (with prescribing doctor): ${JSON.stringify(list)}

Report ONLY well-established drug-drug interactions and duplicate therapy (same active ingredient from different brands/doctors).
Do not invent interactions. If none, return empty arrays. Do not advise stopping any medicine.

Return JSON:
{
  "interactions": [
    {"medicines": ["A","B"], "severity": "low|moderate|high", "explanationBn": "সহজ বাংলায় ১-২ বাক্য", "explanationEn": "1-2 simple sentences", "advice": "Ask your doctor/pharmacist about ..."}
  ],
  "duplicateTherapies": [
    {"medicines": ["Napa","Ace"], "activeIngredient": "Paracetamol", "noteBn": "...", "noteEn": "..."}
  ]
}`;

  const cacheKey = list
    .map((m) => m.name.trim().toLowerCase())
    .sort()
    .join("|");
  let ai = interactionCache.get(cacheKey);
  if (!ai) {
    ai = await withAiQuota(userId, "interactions", () =>
      geminiJson<{ interactions: any[]; duplicateTherapies: any[] }>(prompt)
    );
    interactionCache.set(cacheKey, ai);
  }
  return {
    medicines: list,
    interactions: ai.interactions || [],
    duplicateTherapies: ai.duplicateTherapies || [],
    disclaimer,
  };
};

// ───────────── Emergency card / preferences ─────────────

export const getEmergencyCardService = async (userId: string) => {
  const u = await User.findById(userId).select(
    "fullName bloodGroup allergies chronicConditions emergencyContacts"
  );
  if (!u) throw new Error("User not found");
  return {
    name: u.fullName,
    bloodGroup: u.bloodGroup || null,
    allergies: u.allergies,
    chronicConditions: u.chronicConditions,
    emergencyContacts: u.emergencyContacts,
  };
};

export const updateEmergencyCardService = async (
  userId: string,
  data: {
    bloodGroup?: string | null;
    allergies?: string[];
    chronicConditions?: string[];
    emergencyContacts?: { name: string; phone: string; relation?: string }[];
  }
) => {
  const update: any = {};
  if (data.bloodGroup !== undefined) update.bloodGroup = data.bloodGroup;
  if (Array.isArray(data.allergies)) update.allergies = data.allergies.map(String).slice(0, 30);
  if (Array.isArray(data.chronicConditions))
    update.chronicConditions = data.chronicConditions.map(String).slice(0, 30);
  if (Array.isArray(data.emergencyContacts))
    update.emergencyContacts = data.emergencyContacts
      .filter((c) => c && c.name && c.phone)
      .slice(0, 5)
      .map((c) => ({ name: String(c.name), phone: String(c.phone), relation: c.relation ? String(c.relation) : undefined }));

  await User.findByIdAndUpdate(userId, update);
  return getEmergencyCardService(userId);
};

export const updatePreferencesService = async (
  userId: string,
  data: { language?: "en" | "bn"; country?: string; voiceReminders?: boolean }
) => {
  const update: any = {};
  if (data.language && ["en", "bn"].includes(data.language)) update.language = data.language;
  if (data.country) {
    const code = data.country.toUpperCase();
    update.country = code;
    update.currency = currencyForCountry(code).currency;
    // Changing country picks the matching language unless one was chosen explicitly
    if (!update.language) update.language = languageForCountry(code);
  }
  if (typeof data.voiceReminders === "boolean") update.voiceReminders = data.voiceReminders;

  const u = await User.findByIdAndUpdate(userId, update, { new: true }).select(
    "language country currency voiceReminders"
  );
  return {
    language: u?.language,
    country: u?.country,
    currency: u?.currency,
    currencySymbol: currencyForCountry(u?.country).symbol,
    voiceReminders: !!u?.voiceReminders,
  };
};

// ───────────── Doctor visit card ─────────────

export const getVisitCardService = async (userId: string, familyMemberId?: string) => {
  const baseQuery: any = { userId: new Types.ObjectId(userId), status: "confirmed" };
  if (familyMemberId) baseQuery.familyMemberId = new Types.ObjectId(familyMemberId);

  const [emergency, medicines, recent, labs, adherence] = await Promise.all([
    getEmergencyCardService(userId),
    getActiveMedicinesService(userId, familyMemberId),
    PrescriptionModel.find(baseQuery).sort({ uploadedAt: -1 }).limit(3).lean(),
    LabReportModel.find({ userId: new Types.ObjectId(userId) }).sort({ reportDate: -1 }).limit(3),
    getAdherenceService(userId, 30),
  ]);

  const latestLab = new Map<string, any>();
  for (const report of labs) {
    for (const r of report.results) {
      if (!latestLab.has(r.name.toLowerCase())) {
        latestLab.set(r.name.toLowerCase(), {
          name: r.name,
          value: r.valueText || r.value,
          unit: r.unit,
          status: r.status,
          date: report.reportDate,
        });
      }
    }
  }

  return {
    generatedAt: new Date(),
    patient: {
      name: recent[0]?.patient?.name || emergency.name,
      age: recent[0]?.patient?.age || null,
      gender: recent[0]?.patient?.gender || null,
      bloodGroup: emergency.bloodGroup,
    },
    allergies: emergency.allergies,
    chronicConditions: emergency.chronicConditions,
    currentMedicines: medicines,
    recentDiagnoses: [...new Set(recent.flatMap((p) => p.diagnosis || []))],
    recentSymptoms: [...new Set(recent.flatMap((p) => p.symptoms || []))],
    recentDoctors: [...new Set(recent.map((p) => p.doctor?.name).filter(Boolean))],
    latestLabValues: Array.from(latestLab.values()),
    adherenceLast30Days: { rate: adherence.adherenceRate, missed: adherence.missed, taken: adherence.taken },
    emergencyContacts: emergency.emergencyContacts,
  };
};
