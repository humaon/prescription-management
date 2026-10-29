import fs from "fs";
import path from "path";
import { Types } from "mongoose";
import { appConfig } from "../config/app.config";
import { geminiJson } from "../lib/gemini";
import { createServiceError } from "../lib/utils";
import { getPrompt } from "../lib/prompt";
import {
  IPrescriptionDocument,
  PrescriptionModel,
} from "../models/prescription.model";
import {
  NormalizedMedicine,
  ParsedPrescription,
  normalizeFollowUp,
  normalizeMedicine,
  normalizeParsedPrescription,
  normalizePrescriptionDate,
  validatePrescriptionParsedData,
} from "../validation/prescription.validation";
import { ReminderModel } from "../models/reminder.model";
import { DEFAULT_REMINDER_TIMES, User } from "../models/user.model";
import { DoseLogModel, DoseSlot } from "../models/doseLog.model";
import { deleteReport } from "../lib/reportStorage";
import { normalizeVitals } from "../lib/vitals";
import { allergyClash, cleanAllergies, mergeAllergies } from "../lib/allergies";
import { LabResult } from "../lib/reportReader";
import {
  addDaysYmd,
  endOfDayInAppTz,
  startOfDayInAppTz,
  weekdayInAppTz,
  weekdayOfYmd,
  ymdInAppTz,
} from "../lib/appDate";
import { PrescriptionFeedbackModel } from "../models/PrescriptionFeedback.model";
import PDFDocument from 'pdfkit';
import crypto from "crypto";
import { ClinicalNarrativeModel } from "../models/clinicalNarrative.model";
import { currentProfileId, profileFilter } from "../lib/requestScope";


// Parse prescription text using Gemini API

// Parse prescription text using Gemini API
export const prescriptionParseService = async (
  text: string
): Promise<ParsedPrescription> => {
  if (!text || text.trim().length === 0) {
    throw new Error("Prescription text is empty");
  }

  const prompt = getPrompt(text);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${appConfig.GEMINI_API_KEY}`;

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
      responseMimeType: "application/json",
      temperature: 0,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Gemini API error: ${response.status} - ${error || response.statusText}`
      );
    }

    const data: any = await response.json();

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

    if (!validatePrescriptionParsedData(parsedData)) {
      throw new Error("Parsed data does not match required schema");
    }

    // Coerce the structured fields; derive any the model omitted from the text
    return normalizeParsedPrescription(parsedData, text);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Prescription parsing failed: ${error.message}`);
    }
    throw new Error("Prescription parsing failed: Unknown error");
  }
};



// export const prescriptionParseService = async (
//   text: string
// ): Promise<ParsedPrescription> => {
//   if (!text || text.trim().length === 0) {
//     throw new Error("Prescription text is empty");
//   }

//   const prompt = getPrompt(text);
//   const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${appConfig.GEMINI_API_KEY}`;

//   const payload = {
//     contents: [
//       {
//         parts: [
//           {
//             text: prompt,
//           },
//         ],
//       },
//     ],
//     generationConfig: {
//       temperature: 0.1,
//       topP: 0.95,
//       topK: 40,
//       maxOutputTokens: 2048,
//     },
//   };

//   try {
//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(payload),
//       signal: AbortSignal.timeout(30000),
//     });

//     if (!response.ok) {
//       const error = await response.text();
//       throw new Error(
//         `Gemini API error: ${response.status} - ${error || response.statusText}`
//       );
//     }

//     const data: any = await response.json();

//     if (
//       !data.candidates ||
//       !Array.isArray(data.candidates) ||
//       !data.candidates[0]
//     ) {
//       throw new Error(
//         "Invalid response structure from Gemini API: no candidates"
//       );
//     }

//     if (!data.candidates[0].content || !data.candidates[0].content.parts) {
//       throw new Error("Invalid response structure from Gemini API: no content");
//     }

//     const responseText = data.candidates[0].content.parts[0].text;

//     if (!responseText || typeof responseText !== "string") {
//       throw new Error("Gemini API returned empty or invalid text");
//     }

//     const jsonMatch = responseText.match(/\{[\s\S]*\}/);
//     if (!jsonMatch) {
//       throw new Error(
//         "Could not parse JSON from prescription text. Response: " +
//           responseText.substring(0, 200)
//       );
//     }

//     let parsedData: any;
//     try {
//       parsedData = JSON.parse(jsonMatch[0]);
//     } catch (parseError) {
//       throw new Error(
//         `Failed to parse JSON: ${
//           parseError instanceof Error ? parseError.message : "Unknown error"
//         }`
//       );
//     }

//     if (!validatePrescriptionParsedData(parsedData)) {
//       throw new Error("Parsed data does not match required schema");
//     }

//     if (parsedData.medicines.length > 0) {
//       parsedData.medicines = parsedData.medicines.filter(
//         (med: any) => med.name && med.name.trim().length > 0
//       );
//     }

//     parsedData.symptoms = [...new Set(parsedData.symptoms.filter(Boolean))];
//     parsedData.diagnosis = [...new Set(parsedData.diagnosis.filter(Boolean))];

//     return parsedData as ParsedPrescription;
//   } catch (error) {
//     if (error instanceof Error) {
//       throw new Error(`Prescription parsing failed: ${error.message}`);
//     }
//     throw new Error("Prescription parsing failed: Unknown error");
//   }
// };

// End of the last day of a `days`-day course whose first day is startYmd
// ("5 days" from Monday → end of Friday)
const endDateForDays = (startYmd: string, days: number): Date =>
  endOfDayInAppTz(addDaysYmd(startYmd, days - 1));

// Day the course starts: the prescription date, else the upload day
const courseStartYmd = (p: { prescriptionDate?: string | null; uploadedAt?: Date }) =>
  p.prescriptionDate || ymdInAppTz(p.uploadedAt ?? new Date());

// Fields a client may set when saving / editing a prescription
const EDITABLE_FIELDS = [
  "doctor",
  "patient",
  "symptoms",
  "diagnosis",
  "tests",
  "medicines",
  "notes",
  "followUp",
  "prescriptionDate",
  "vitals",
  "allergies",
] as const;

// Allergies written on a prescription join that person's allergy list
// (the family member's, or the account holder's)
const rememberAllergies = async (
  userId: string,
  allergies: string[] | undefined,
  profileId: Types.ObjectId | null | undefined
) => {
  if (!allergies?.length) return;
  const user = await User.findById(userId).select("allergies profiles");
  if (!user) return;
  const profile = profileId ? user.profiles.find((p) => p._id.equals(profileId)) : null;
  if (profile) profile.allergies = mergeAllergies(profile.allergies ?? [], allergies);
  else if (!profileId) user.allergies = mergeAllergies(user.allergies ?? [], allergies);
  await user.save();
};

// Allergies of the active person (family member or account holder)
const allergiesOf = async (userId: string): Promise<string[]> => {
  const profileId = currentProfileId();
  const user = await User.findById(userId).select("allergies profiles").lean();
  if (!profileId) return user?.allergies ?? [];
  return user?.profiles?.find((p) => p._id.equals(profileId))?.allergies ?? [];
};

const pickEditable = (data: any) => {
  const out: Record<string, any> = {};
  for (const key of EDITABLE_FIELDS) if (key in (data ?? {})) out[key] = data[key];
  // Numbers are always re-derived from the written values
  if ("vitals" in out) out.vitals = normalizeVitals(out.vitals);
  if ("allergies" in out) out.allergies = cleanAllergies(out.allergies);
  return out;
};

// Incoming tests keep the status/report of the stored test with the same _id;
// anything new starts as pending
const mergeTests = (incoming: any[], existing: any[] = []) =>
  incoming
    .filter((t) => t && typeof t.name === "string" && t.name.trim())
    .map((t) => {
      const prev = t._id ? existing.find((e) => e._id?.toString() === String(t._id)) : null;
      if (prev) {
        const base = typeof prev.toObject === "function" ? prev.toObject() : prev;
        return { ...base, name: t.name.trim(), type: t.type || null };
      }
      return {
        name: t.name.trim(),
        type: t.type || null,
        status: "pending",
        completedDate: null,
        reportUrl: null,
        resultSummary: null,
        notes: null,
      };
    });

// Tablets/capsules per dose from the dosage text ("1 tab", "½", "1/2", "২টা"); 1 when unclear
const unitsPerDoseOf = (dosage?: string | null) => {
  const s = String(dosage ?? "").replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  if (/½/.test(s)) return 0.5;
  if (/¼/.test(s)) return 0.25;
  const frac = /(\d+)\s*\/\s*(\d+)/.exec(s);
  if (frac && !/ml|মিলি/i.test(s)) return parseInt(frac[1], 10) / parseInt(frac[2], 10) || 1;
  const n = /(\d+(?:\.\d+)?)/.exec(s);
  const v = n ? parseFloat(n[1]) : 1;
  return v > 0 && v <= 10 ? v : 1;
};

// Days the stock lasts at this reminder's pace; null when stock isn't tracked
export const stockDaysLeft = (r: {
  stockCount?: number | null;
  unitsPerDose?: number;
  schedules?: { morning?: boolean; noon?: boolean; night?: boolean };
  daysOfWeek?: number[];
}) => {
  if (r.stockCount === null || r.stockCount === undefined) return null;
  const slots = ["morning", "noon", "night"].filter((s) => (r.schedules as any)?.[s]).length;
  const daysPerWeek = r.daysOfWeek?.length ? r.daysOfWeek.length : 7;
  const perDay = (r.unitsPerDose || 1) * slots * (daysPerWeek / 7);
  return perDay > 0 ? Math.floor(r.stockCount / perDay) : null;
};

// Helper: Create reminders for medicines.
// Structured fields are used when present; old-shaped medicines (no structured
// fields) are normalised from their free text first. `stockByName` carries
// tracked stock over when reminders are rebuilt after an edit.
const createRemindersForMedicines = async (
  prescriptionId: string,
  userId: string,
  medicines: any[],
  startYmd: string,
  stockByName: Map<string, number | null> = new Map(),
  profileId: Types.ObjectId | null = null
) => {
  const reminders = [];
  const today = ymdInAppTz();
  // Started today → from now (so a dose slot already past isn't "due"); else from that day
  const startDate = startYmd >= today ? new Date() : startOfDayInAppTz(startYmd);

  for (const raw of medicines) {
    const medicine = normalizeMedicine(raw);
    if (!medicine.name) continue;

    // As-needed and one-time medicines get no recurring reminder
    if (medicine.scheduleType === "as_needed" || medicine.scheduleType === "once") continue;

    const { morning, noon, night } = medicine.schedule;
    if (!morning && !noon && !night) continue;

    const isWeekly = medicine.scheduleType === "weekly";
    const reminder = new ReminderModel({
      userId: new Types.ObjectId(userId),
      profileId,
      prescriptionId: new Types.ObjectId(prescriptionId),
      medicineName: medicine.name,
      dosage: medicine.dosage || "",
      schedules: { morning, noon, night },
      scheduleType: isWeekly ? "weekly" : "daily",
      // Weekly with no day stated → the weekday the course started on
      daysOfWeek: isWeekly
        ? medicine.weekDays.length
          ? medicine.weekDays
          : [weekdayOfYmd(startYmd)]
        : [],
      isActive: true,
      unitsPerDose: unitsPerDoseOf(medicine.dosage),
      stockCount: stockByName.get(medicine.name) ?? null,
      startDate,
      endDate:
        medicine.continueIndefinitely || !medicine.durationDays
          ? null
          : endDateForDays(startYmd, medicine.durationDays),
    });

    reminders.push(await reminder.save());
  }

  return reminders;
};

// Save prescription with user-edited data and auto-create reminders
export const prescriptionSaveService = async (
  body: any,
  userId: string
) => {
  const prescriptionData = pickEditable(body);
  prescriptionData.prescriptionDate = normalizePrescriptionDate(prescriptionData.prescriptionDate);
  const startYmd = prescriptionData.prescriptionDate || ymdInAppTz();

  prescriptionData.tests = mergeTests(Array.isArray(prescriptionData.tests) ? prescriptionData.tests : []);
  // Normalise medicines (old app versions send only the free-text fields)
  if (Array.isArray(prescriptionData.medicines)) {
    prescriptionData.medicines = prescriptionData.medicines
      .filter((m: any) => m && typeof m.name === "string" && m.name.trim())
      .map((m: any) => normalizeMedicine(m));
  }
  // Follow-up: date = prescription date + inDays when only the interval is known
  // (old app versions send no followUp key: look for it in the notes instead)
  prescriptionData.followUp = normalizeFollowUp(
    prescriptionData.followUp,
    prescriptionData.followUp === undefined ? prescriptionData.notes : null,
    true,
    startYmd
  );

  // Create new prescription with user-edited data
  const prescription = new PrescriptionModel({
    ...prescriptionData,
    ocrText: typeof body?.ocrText === "string" ? body.ocrText : "",
    userId: new Types.ObjectId(userId),
    profileId: currentProfileId(),
    status: "confirmed",
    processingStatus: "completed",
    parsedAt: new Date(),
    uploadedAt: new Date(),
    isCurrent: typeof body?.isCurrent === "boolean" ? body.isCurrent : true,
    isComplete: false,
  });

  const savedPrescription = await prescription.save();
  await rememberAllergies(userId, savedPrescription.allergies, savedPrescription.profileId);

  // Auto-create reminders if prescription is current
  if (savedPrescription.isCurrent && savedPrescription.medicines.length > 0) {
    try {
      await createRemindersForMedicines(
        savedPrescription._id.toString(),
        userId,
        savedPrescription.medicines,
        startYmd,
        new Map(),
        savedPrescription.profileId ?? null
      );
    } catch (error) {
      console.error("Failed to create reminders:", error);
      // Don't fail the save if reminder creation fails
    }
  }

  return savedPrescription;
};

// Update existing prescription
export const prescriptionUpdateService = async (
  prescriptionId: string,
  userId: string,
  body: any
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  });

  if (!prescription) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  const updateData = pickEditable(body);
  if ("prescriptionDate" in updateData) {
    updateData.prescriptionDate = normalizePrescriptionDate(updateData.prescriptionDate);
  }
  const startYmd = courseStartYmd({
    prescriptionDate:
      "prescriptionDate" in updateData ? updateData.prescriptionDate : prescription.prescriptionDate,
    uploadedAt: prescription.uploadedAt,
  });

  if (Array.isArray(updateData.medicines)) {
    updateData.medicines = updateData.medicines
      .filter((m: any) => m && typeof m.name === "string" && m.name.trim())
      .map((m: any) => normalizeMedicine(m));
  }
  if (Array.isArray(updateData.tests)) {
    updateData.tests = mergeTests(updateData.tests, prescription.tests);
  } else {
    delete updateData.tests;
  }
  if ("followUp" in updateData) {
    const prev = prescription.followUp;
    const next = normalizeFollowUp(updateData.followUp, null, true, startYmd);
    // Keep the "already notified" marks when the visit date didn't change
    updateData.followUp =
      next && prev?.date === next.date
        ? { ...next, notifiedAt: prev?.notifiedAt ?? null, dayOfNotifiedAt: prev?.dayOfNotifiedAt ?? null }
        : next;
  }

  Object.assign(prescription, updateData);
  prescription.parsedAt = new Date();

  const updatedPrescription = await prescription.save();
  await rememberAllergies(userId, updateData.allergies, updatedPrescription.profileId);

  // Rebuild reminders from the edited medicines (courses still count from the
  // prescription date, so an edit doesn't restart them)
  if (updatedPrescription.isCurrent && !updatedPrescription.isComplete) {
    try {
      const owned = {
        prescriptionId: new Types.ObjectId(prescriptionId),
        userId: new Types.ObjectId(userId),
      };
      const old = await ReminderModel.find(owned).select("medicineName stockCount").lean();
      const stockByName = new Map(old.map((r) => [r.medicineName, r.stockCount ?? null]));
      await ReminderModel.deleteMany(owned);
      await createRemindersForMedicines(
        prescriptionId,
        userId,
        updatedPrescription.medicines,
        startYmd,
        stockByName,
        updatedPrescription.profileId ?? null
      );
    } catch (error) {
      console.error("Failed to update reminders:", error);
    }
  }

  return updatedPrescription;
};

// ---------- Duplicate medicine check ----------
// "Napa 500 mg" / "Tab. Napa" → "napa"
const brandKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/^(tab|cap|syp|syr|susp|inj|drop|drops)\.?\s+/i, "")
    .replace(/[\d০-৯.,]+\s*(mg|mcg|g|ml|iu|units?|%|মিগ্রা|মিলি)?(\s*\/\s*[\d০-৯.]+\s*(ml|মিলি)?)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

// "Paracetamol + Caffeine" → ["paracetamol", "caffeine"]
const ingredients = (generic?: string | null) =>
  String(generic ?? "")
    .toLowerCase()
    .split(/\s*(?:\+|,|\/|&|\band\b)\s*/)
    .map((s) => s.replace(/[^a-z\s-]/g, "").trim())
    .filter((s) => s.length > 2);

export interface MedicineWarning {
  medicine: string;
  conflictsWith: string;
  reason: "same_medicine" | "same_ingredient" | "allergy";
  ingredient: string | null;
  // null = the clash is inside the prescription being saved
  existing: { prescriptionId: string; doctorName: string | null } | null;
}

/**
 * Medicines in `medicines` that repeat one already being taken (same brand,
 * or a shared active ingredient — e.g. two paracetamol brands), or each other.
 */
export const checkMedicinesService = async (
  userId: string,
  rawMedicines: any[],
  excludePrescriptionId?: string,
  extraAllergies: string[] = []
): Promise<MedicineWarning[]> => {
  const today = ymdInAppTz();
  const allergies = mergeAllergies(await allergiesOf(userId), cleanAllergies(extraAllergies));
  const current = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    isCurrent: true,
    isComplete: { $ne: true },
    ...(excludePrescriptionId && Types.ObjectId.isValid(excludePrescriptionId)
      ? { _id: { $ne: new Types.ObjectId(excludePrescriptionId) } }
      : {}),
  })
    .select("medicines doctor prescriptionDate uploadedAt")
    .lean();

  // Only medicines whose course is still running
  const existing = current.flatMap((p) => {
    const start = courseStartYmd(p);
    return p.medicines
      .map((m) => normalizeMedicine(m))
      .filter((m) => m.continueIndefinitely || !m.durationDays || addDaysYmd(start, m.durationDays - 1) >= today)
      .map((m) => ({ med: m, prescriptionId: p._id.toString(), doctorName: p.doctor?.name ?? null }));
  });

  const incoming = (Array.isArray(rawMedicines) ? rawMedicines : [])
    .filter((m) => m && typeof m.name === "string" && m.name.trim())
    .map((m) => normalizeMedicine(m));

  const clash = (a: NormalizedMedicine, b: NormalizedMedicine) => {
    const ka = brandKey(a.name);
    if (ka && ka === brandKey(b.name)) return { reason: "same_medicine" as const, ingredient: null };
    const shared = ingredients(a.genericName).find((i) => ingredients(b.genericName).includes(i));
    return shared ? { reason: "same_ingredient" as const, ingredient: shared } : null;
  };

  const warnings: MedicineWarning[] = [];
  incoming.forEach((med, i) => {
    const allergy = allergyClash(med, allergies);
    if (allergy) {
      warnings.push({ medicine: med.name, conflictsWith: allergy, reason: "allergy", ingredient: null, existing: null });
    }
    for (const e of existing) {
      const c = clash(med, e.med);
      if (c) {
        warnings.push({
          medicine: med.name,
          conflictsWith: e.med.name,
          ...c,
          existing: { prescriptionId: e.prescriptionId, doctorName: e.doctorName },
        });
      }
    }
    for (const other of incoming.slice(i + 1)) {
      const c = clash(med, other);
      if (c) warnings.push({ medicine: med.name, conflictsWith: other.name, ...c, existing: null });
    }
  });
  return warnings;
};

// Get all prescriptions for a user
export const prescriptionGetAllService = async (userId: string) => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
  })
    .sort({ uploadedAt: -1 })
    .lean();

  return prescriptions;
};

// Get only current prescriptions
export const prescriptionGetCurrentService = async (userId: string) => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    isCurrent: true,
  })
    .sort({ uploadedAt: -1 })
    .lean();

  return prescriptions;
};

// Get active medications from current prescriptions
export const getActiveMedicationsService = async (userId: string) => {
  const currentPrescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    isCurrent: true,
    isComplete: false, 
  })
    .select("medicines doctor uploadedAt patient _id")
    .sort({ uploadedAt: -1 })
    .lean();

  const activeMedications = currentPrescriptions.flatMap((prescription) =>
    prescription.medicines.map((medicine) => ({
      ...medicine,
      prescriptionId: prescription._id,
      doctorName: prescription.doctor.name,
      prescribedDate: prescription.uploadedAt,
      patientName: prescription.patient.name,
    }))
  );

  return {
    totalMedications: activeMedications.length,
    totalPrescriptions: currentPrescriptions.length,
    medications: activeMedications,
  };
};

// Get single prescription by ID
export const prescriptionGetByIdService = async (
  prescriptionId: string,
  userId: string
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  }).lean();

  return prescription;
};

// Delete prescription by ID
export const prescriptionDeleteByIdService = async (
  prescriptionId: string,
  userId: string
) => {
  const deletedPrescription = await PrescriptionModel.findOneAndDelete({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  });

  if (!deletedPrescription) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  // Only after ownership is confirmed: its reminders and their dose history
  const owned = { prescriptionId: deletedPrescription._id, userId: deletedPrescription.userId };
  const reminderIds = await ReminderModel.find(owned).distinct("_id");
  await DoseLogModel.deleteMany({ reminderId: { $in: reminderIds } });
  await ReminderModel.deleteMany(owned);
  await Promise.all(deletedPrescription.tests.map((t) => deleteReport(t.reportUrl)));

  return deletedPrescription;
};

// Everything saved for one family member (used when the member is removed)
export const deleteProfileDataService = async (userId: string, profileId: Types.ObjectId) => {
  const owner = { userId: new Types.ObjectId(userId), profileId };
  const prescriptions = await PrescriptionModel.find(owner).select("_id tests.reportUrl").lean();
  const ids = prescriptions.map((p) => p._id);
  const reminderIds = await ReminderModel.find({ prescriptionId: { $in: ids } }).distinct("_id");
  await DoseLogModel.deleteMany({ reminderId: { $in: reminderIds } });
  await ReminderModel.deleteMany({ prescriptionId: { $in: ids } });
  await PrescriptionFeedbackModel.deleteMany({ prescriptionId: { $in: ids } });
  await ClinicalNarrativeModel.deleteMany(owner);
  await Promise.all(prescriptions.flatMap((p) => p.tests.map((t) => deleteReport(t.reportUrl))));
  await PrescriptionModel.deleteMany({ _id: { $in: ids } });
};

// Toggle prescription current/archived status
export const togglePrescriptionCurrentStatus = async (
  prescriptionId: string,
  userId: string,
  isCurrent: boolean
) => {
  const prescription = await PrescriptionModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(prescriptionId),
      userId: new Types.ObjectId(userId),
    },
    { isCurrent },
    { new: true }
  );

  if (!prescription) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  // If archiving, deactivate reminders
  if (!isCurrent) {
    await ReminderModel.updateMany(
      {
        prescriptionId: new Types.ObjectId(prescriptionId),
      },
      { isActive: false }
    );
  } else {
    // If marking as current, reactivate reminders
    await ReminderModel.updateMany(
      {
        prescriptionId: new Types.ObjectId(prescriptionId),
      },
      { isActive: true }
    );
  }

  return prescription;
};

// Get user reminders
// Calendar day in the app's timezone (users are in Bangladesh; the server runs in UTC)
export const todayInAppTimezone = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: appConfig.APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

// Reminders due on the given day: daily ones, and weekly ones on their weekday
// (reminders created before daysOfWeek existed have no field → every day)
const dueOnDayFilter = (dayOfWeek: number) => ({
  $or: [
    { daysOfWeek: { $exists: false } },
    { daysOfWeek: { $size: 0 } },
    { daysOfWeek: dayOfWeek },
  ],
});

export const getUserRemindersService = async (userId: string) => {
  const now = new Date();
  const reminders = await ReminderModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    isActive: true,
    startDate: { $lte: now },
    $and: [
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      dueOnDayFilter(weekdayInAppTz(now)),
    ],
  })
    .populate("prescriptionId", "doctor patient uploadedAt")
    .sort({ createdAt: -1 })
    .lean();

  // Attach which of today's doses were already marked as taken
  const logs = await DoseLogModel.find({
    reminderId: { $in: reminders.map((r) => r._id) },
    date: todayInAppTimezone(now),
  }).lean();

  // Dose times are the user's (one setting for all medicines)
  const user = await User.findById(userId).select("reminderTimes").lean();
  const timings = { ...DEFAULT_REMINDER_TIMES, ...(user?.reminderTimes ?? {}) };

  return reminders.map((r) => {
    const taken = logs.filter((l) => l.reminderId.equals(r._id));
    return {
      ...r,
      timings,
      stockDaysLeft: stockDaysLeft(r),
      scheduleType: r.scheduleType || "daily",
      daysOfWeek: r.daysOfWeek || [],
      takenToday: {
        morning: taken.some((l) => l.slot === "morning"),
        noon: taken.some((l) => l.slot === "noon"),
        night: taken.some((l) => l.slot === "night"),
      },
    };
  });
};

// Everything the phone needs to schedule its own alarms for the coming days:
// every active, not-yet-ended reminder plus the user's dose times
export const getReminderScheduleService = async (userId: string) => {
  const now = new Date();
  const [reminders, user] = await Promise.all([
    ReminderModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    })
      .select("prescriptionId profileId medicineName dosage schedules scheduleType daysOfWeek startDate endDate")
      .lean(),
    User.findById(userId).select("reminderTimes localAlarms profiles").lean(),
  ]);
  // The phone rings for every family member; alarms name whose medicine it is
  const nameOf = (pid?: Types.ObjectId | null) =>
    pid ? user?.profiles?.find((p) => p._id.equals(pid))?.name ?? null : null;
  return {
    timezone: appConfig.APP_TIMEZONE,
    reminderTimes: { ...DEFAULT_REMINDER_TIMES, ...(user?.reminderTimes ?? {}) },
    localAlarms: !!user?.localAlarms,
    reminders: reminders.map((r) => ({
      _id: r._id,
      prescriptionId: r.prescriptionId,
      profileName: nameOf(r.profileId),
      medicineName: r.medicineName,
      dosage: r.dosage,
      schedules: r.schedules,
      daysOfWeek: r.scheduleType === "weekly" ? r.daysOfWeek || [] : [],
      startDate: r.startDate,
      endDate: r.endDate ?? null,
    })),
  };
};

// Doses taken vs. doses that were due over the last `days` days (today
// included, but only slots whose time has passed). Uses active reminders.
export const getAdherenceService = async (userId: string, days = 7) => {
  const now = new Date();
  const today = ymdInAppTz(now);
  const [reminders, user] = await Promise.all([
    ReminderModel.find({ userId: new Types.ObjectId(userId), ...profileFilter(), isActive: true }).lean(),
    User.findById(userId).select("reminderTimes").lean(),
  ]);
  const times = { ...DEFAULT_REMINDER_TIMES, ...(user?.reminderTimes ?? {}) };
  const firstDay = addDaysYmd(today, -(days - 1));
  const logs = await DoseLogModel.find({
    reminderId: { $in: reminders.map((r) => r._id) },
    date: { $gte: firstDay, $lte: today },
  }).lean();
  const taken = new Set(logs.map((l) => `${l.reminderId}|${l.date}|${l.slot}`));

  const slotInstant = (ymd: string, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(startOfDayInAppTz(ymd).getTime() + (h * 60 + m) * 60000);
  };

  const perDay: Array<{ date: string; scheduled: number; taken: number }> = [];
  const perMed = new Map<string, { name: string; scheduled: number; taken: number }>();
  for (let i = 0; i < days; i++) {
    const ymd = addDaysYmd(firstDay, i);
    const weekday = weekdayOfYmd(ymd);
    const day = { date: ymd, scheduled: 0, taken: 0 };
    for (const r of reminders) {
      if (r.daysOfWeek?.length && !r.daysOfWeek.includes(weekday)) continue;
      for (const slot of ["morning", "noon", "night"] as const) {
        if (!r.schedules?.[slot]) continue;
        const at = slotInstant(ymd, times[slot]);
        const done = taken.has(`${r._id}|${ymd}|${slot}`);
        // A dose marked taken early still counts before its time comes
        if ((at > now && !done) || at < new Date(r.startDate) || (r.endDate && at > new Date(r.endDate))) continue;
        day.scheduled++;
        if (done) day.taken++;
        const med = perMed.get(r.medicineName) ?? { name: r.medicineName, scheduled: 0, taken: 0 };
        med.scheduled++;
        if (done) med.taken++;
        perMed.set(r.medicineName, med);
      }
    }
    perDay.push(day);
  }

  const scheduled = perDay.reduce((s, d) => s + d.scheduled, 0);
  const takenCount = perDay.reduce((s, d) => s + d.taken, 0);
  return {
    days,
    scheduled,
    taken: takenCount,
    percent: scheduled ? Math.round((takenCount / scheduled) * 100) : null,
    perDay,
    perMedicine: [...perMed.values()]
      .map((m) => ({ ...m, percent: m.scheduled ? Math.round((m.taken / m.scheduled) * 100) : null }))
      .sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101)),
  };
};

// Units on hand for a reminder (null = stop tracking)
export const setReminderStockService = async (userId: string, reminderId: string, count: number | null) => {
  const reminder = await ReminderModel.findOneAndUpdate(
    { _id: new Types.ObjectId(reminderId), userId: new Types.ObjectId(userId) },
    { $set: { stockCount: count, refillAlertedAt: null } },
    { new: true }
  ).lean();
  if (!reminder) {
    throw createServiceError("Reminder not found", 404);
  }
  return { reminderId, stockCount: reminder.stockCount ?? null, daysLeft: stockDaysLeft(reminder) };
};

// Tracked medicines with 3 days or less left, not alerted in the last 2 days
export const getLowStockRemindersService = async () => {
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
  const now = new Date();
  const reminders = await ReminderModel.find({
    isActive: true,
    stockCount: { $ne: null },
    $and: [
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      { $or: [{ refillAlertedAt: null }, { refillAlertedAt: { $lt: twoDaysAgo } }] },
    ],
  }).lean();
  return reminders
    .map((r) => ({ reminder: r, daysLeft: stockDaysLeft(r) }))
    .filter((x): x is { reminder: typeof x.reminder; daysLeft: number } => x.daysLeft !== null && x.daysLeft <= 3);
};

// Mark (taken = true) or unmark one of today's doses
export const setDoseTakenService = async (
  userId: string,
  reminderId: string,
  slot: DoseSlot,
  taken: boolean
) => {
  const reminder = await ReminderModel.findOne({
    _id: new Types.ObjectId(reminderId),
    userId: new Types.ObjectId(userId),
  }).lean();
  if (!reminder) {
    throw createServiceError("Reminder not found", 404);
  }
  if (!reminder.schedules?.[slot]) {
    throw createServiceError(`This medicine has no ${slot} dose`, 400);
  }

  const key = { reminderId: reminder._id, slot, date: todayInAppTimezone() };
  // Only a real change moves the stock (marking twice must not use two doses)
  let changed = false;
  if (taken) {
    const res = await DoseLogModel.updateOne(
      key,
      { $setOnInsert: { ...key, userId: reminder.userId, takenAt: new Date() } },
      { upsert: true }
    );
    changed = res.upsertedCount > 0;
  } else {
    changed = (await DoseLogModel.deleteOne(key)).deletedCount > 0;
  }
  if (changed && reminder.stockCount !== null && reminder.stockCount !== undefined) {
    const delta = (taken ? -1 : 1) * (reminder.unitsPerDose || 1);
    await ReminderModel.updateOne({ _id: reminder._id }, [
      { $set: { stockCount: { $max: [0, { $add: ["$stockCount", delta] }] } } },
    ]);
  }
  return { reminderId, slot, taken, date: key.date };
};

// Get due reminders for notification scheduler
export const getDueRemindersService = async (
  timeSlot: "morning" | "noon" | "night"
) => {
  const now = new Date();

  return await ReminderModel.find({
    isActive: true,
    [`schedules.${timeSlot}`]: true,
    startDate: { $lte: now },
    $and: [
      { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      // Weekly reminders only on their weekday (app timezone)
      dueOnDayFilter(weekdayInAppTz(now)),
    ],
  })
    .populate("userId", "email name localAlarms profiles")
    .lean();
};

// Upcoming follow-up visits (today or later), soonest first
export const getUpcomingFollowUpsService = async (userId: string) => {
  const today = ymdInAppTz();
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    "followUp.date": { $gte: today },
  })
    .select("doctor followUp uploadedAt")
    .sort({ "followUp.date": 1 })
    .lean();

  return prescriptions.map((p) => ({
    prescriptionId: p._id,
    doctorName: p.doctor?.name ?? null,
    doctorSpecialization: p.doctor?.specialization ?? null,
    date: p.followUp!.date,
    inDays: p.followUp?.inDays ?? null,
    note: p.followUp?.note ?? null,
    prescribedAt: p.uploadedAt,
  }));
};

// Follow-up visits still to be announced: tomorrow's ("visit tomorrow", checked
// on every reminder run so one saved late in the day is still announced) and
// today's ("visit today")
export const getFollowUpsToNotifyService = async (when: "tomorrow" | "today") => {
  const today = ymdInAppTz();
  return await PrescriptionModel.find({
    isComplete: { $ne: true },
    ...(when === "tomorrow"
      ? { "followUp.date": addDaysYmd(today, 1), "followUp.notifiedAt": null }
      : { "followUp.date": today, "followUp.dayOfNotifiedAt": null }),
  })
    .select("userId doctor followUp tests")
    .lean();
};

// Prescriptions whose pending tests are due a "still pending" nudge: stage 1
// from day 3 after the prescription date, stage 2 from day 7
export const getPendingTestRemindersService = async () => {
  const today = ymdInAppTz();
  const prescriptions = await PrescriptionModel.find({
    isComplete: { $ne: true },
    tests: { $elemMatch: { status: "pending", reminderStage: { $not: { $gte: 2 } } } },
  })
    .select("userId doctor tests prescriptionDate uploadedAt")
    .lean();

  return prescriptions.flatMap((p) => {
    const start = courseStartYmd(p);
    const days = Math.round(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000
    );
    const stage = days >= 7 ? 2 : days >= 3 ? 1 : 0;
    const due = p.tests.filter((t: any) => t.status === "pending" && (t.reminderStage ?? 0) < stage);
    // Old prescriptions (well past day 7) are not nagged retroactively
    if (!stage || !due.length || days > 30) return [];
    return [{ prescription: p, stage, days, tests: due }];
  });
};

// Get prescription statistics
export const getPrescriptionStatsService = async (userId: string) => {
  const stats = await PrescriptionModel.aggregate([
    {
      $match: { userId: new Types.ObjectId(userId), ...profileFilter() },
    },
    {
      $facet: {
        total: [{ $count: "count" }],
        current: [{ $match: { isCurrent: true } }, { $count: "count" }],
        archived: [{ $match: { isCurrent: false } }, { $count: "count" }],
        byStatus: [
          {
            $group: {
              _id: "$processingStatus",
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  return {
    total: stats[0]?.total[0]?.count || 0,
    current: stats[0]?.current[0]?.count || 0,
    archived: stats[0]?.archived[0]?.count || 0,
    byStatus: stats[0]?.byStatus || [],
  };
};
export interface IHealthInsights {
  mostUsedMedicines: Array<{
    name: string;
    genericName?: string;
    count: number;
    percentage: number;
  }>;
  commonSymptoms: Array<{
    symptom: string;
    count: number;
    percentage: number;
  }>;
  treatmentStats: {
    totalPrescriptions: number;
    activeMedications: number;
    doctorsConsulted: number;
    archivedPrescriptions: number;
  };
  medicationTrends: {
    currentMonthPrescriptions: number;
    lastMonthPrescriptions: number;
    changePercentage: number;
  };
  topDoctors: Array<{
    name: string;
    specialization: string | null;
    consultationCount: number;
  }>;
  recentDiagnoses: string[];
}

// Helper functions
const extractGenericName = (medicineName: string): string | undefined => {
  const match = medicineName.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : undefined;
};

const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Main service function
export const getHealthInsightsService = async (
  userId: string
): Promise<IHealthInsights> => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    status: "confirmed",
  })
    .sort({ uploadedAt: -1 })
    .lean();

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Most used medicines
  const medicineCount = new Map<string, number>();
  prescriptions.forEach((prescription) => {
    prescription.medicines.forEach((medicine) => {
      const medicineName = medicine.name.trim();
      medicineCount.set(medicineName, (medicineCount.get(medicineName) || 0) + 1);
    });
  });

  const totalMedicineInstances = Array.from(medicineCount.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  const mostUsedMedicines = Array.from(medicineCount.entries())
    .map(([name, count]) => ({
      name,
      genericName: extractGenericName(name),
      count,
      percentage: totalMedicineInstances > 0 ? Math.round((count / totalMedicineInstances) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Common symptoms
  const symptomCount = new Map<string, number>();
  prescriptions.forEach((prescription) => {
    prescription.symptoms.forEach((symptom) => {
      const normalizedSymptom = symptom.trim().toLowerCase();
      if (normalizedSymptom) {
        symptomCount.set(normalizedSymptom, (symptomCount.get(normalizedSymptom) || 0) + 1);
      }
    });
  });

  const totalSymptomInstances = Array.from(symptomCount.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  const commonSymptoms = Array.from(symptomCount.entries())
    .map(([symptom, count]) => ({
      symptom: capitalizeFirst(symptom),
      count,
      percentage: totalSymptomInstances > 0 ? Math.round((count / totalSymptomInstances) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Treatment stats
  const activeMedicationsSet = new Set<string>();
  const doctorNamesSet = new Set<string>();

  prescriptions.forEach((prescription) => {
    if (prescription.isCurrent) {
      prescription.medicines.forEach((medicine) => {
        activeMedicationsSet.add(medicine.name.trim());
      });
    }
    if (prescription.doctor?.name) {
      doctorNamesSet.add(prescription.doctor.name.trim());
    }
  });

  const treatmentStats = {
    totalPrescriptions: prescriptions.length,
    activeMedications: activeMedicationsSet.size,
    doctorsConsulted: doctorNamesSet.size,
    archivedPrescriptions: prescriptions.filter((p) => !p.isCurrent).length,
  };

  // Medication trends
  const currentMonthPrescriptions = prescriptions.filter(
    (p) => new Date(p.uploadedAt) >= currentMonthStart
  ).length;

  const lastMonthPrescriptions = prescriptions.filter(
    (p) =>
      new Date(p.uploadedAt) >= lastMonthStart &&
      new Date(p.uploadedAt) <= lastMonthEnd
  ).length;

  const changePercentage =
    lastMonthPrescriptions > 0
      ? Math.round(((currentMonthPrescriptions - lastMonthPrescriptions) / lastMonthPrescriptions) * 100)
      : currentMonthPrescriptions > 0
      ? 100
      : 0;

  const medicationTrends = {
    currentMonthPrescriptions,
    lastMonthPrescriptions,
    changePercentage,
  };

  // Top doctors
  const doctorConsultations = new Map<
    string,
    { name: string; specialization: string | null; count: number }
  >();

  prescriptions.forEach((prescription) => {
    if (prescription.doctor?.name) {
      const doctorName = prescription.doctor.name.trim();
      const existing = doctorConsultations.get(doctorName);
      if (existing) {
        existing.count += 1;
      } else {
        doctorConsultations.set(doctorName, {
          name: doctorName,
          specialization: prescription.doctor.specialization || null,
          count: 1,
        });
      }
    }
  });

  const topDoctors = Array.from(doctorConsultations.values())
    .map((doc) => ({
      name: doc.name,
      specialization: doc.specialization,
      consultationCount: doc.count,
    }))
    .sort((a, b) => b.consultationCount - a.consultationCount)
    .slice(0, 5);

  // Recent diagnoses
  const recentDiagnosesSet = new Set<string>();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  prescriptions
    .filter((p) => new Date(p.uploadedAt) >= sixMonthsAgo)
    .forEach((prescription) => {
      prescription.diagnosis.forEach((diag) => {
        if (diag && diag.trim()) {
          recentDiagnosesSet.add(diag.trim());
        }
      });
    });

  const recentDiagnoses = Array.from(recentDiagnosesSet).slice(0, 10);

  return {
    mostUsedMedicines,
    commonSymptoms,
    treatmentStats,
    medicationTrends,
    topDoctors,
    recentDiagnoses,
  };
}
// export const prescriptionGetByIdService = async (
//   prescriptionId: string,
//   userId: string
// ) => {
//   const prescription = await PrescriptionModel.findOne({
//     _id: new Types.ObjectId(prescriptionId),
//     userId: new Types.ObjectId(userId),
//   }).lean();

//   return prescription;
// };

/**
 * NEW: Get prescription details with related data (reminders, feedback, test status)
 */
export const getPrescriptionDetailsService = async (
  prescriptionId: string,
  userId: string
) => {
  // Get prescription
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  }).lean();

  if (!prescription) {
    return null;
  }

  // Get reminders for this prescription
  const reminders = await ReminderModel.find({
    prescriptionId: new Types.ObjectId(prescriptionId),
  }).lean();

  // Get feedback (if completed)
  const feedback = await PrescriptionFeedbackModel.findOne({
    prescriptionId: new Types.ObjectId(prescriptionId),
  }).lean();

  // Calculate test statistics
  const testStats = {
    total: prescription.tests.length,
    pending: prescription.tests.filter((t: any) => t.status === "pending").length,
    completed: prescription.tests.filter((t: any) => t.status === "completed").length,
    cancelled: prescription.tests.filter((t: any) => t.status === "cancelled").length,
  };

  // Check if all tests are completed
  const allTestsCompleted =
    prescription.tests.length === 0 ||
    prescription.tests.every(
      (t: any) => t.status === "completed" || t.status === "cancelled"
    );

  return {
    prescription,
    reminders: {
      total: reminders.length,
      active: reminders.filter((r) => r.isActive).length,
      list: reminders,
    },
    prescriptionTests: {
      ...testStats,
      allCompleted: allTestsCompleted,
      list: prescription.tests,
    },
    feedback: feedback || null,
    canComplete: allTestsCompleted && !prescription.isComplete,
  };
};

// ============================================
// NEW SERVICES - TEST TRACKING
// ============================================

export const getPendingTestsService = async (userId: string) => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    "tests.status": "pending",
  })
    .select("_id doctor patient uploadedAt diagnosis tests")
    .lean();

  const pendingTests = prescriptions.flatMap((prescription) =>
    prescription.tests
      .filter((test: any) => test.status === "pending")
      .map((test: any) => ({
        prescriptionId: prescription._id,
        testId: test._id,
        testName: test.name,
        testType: test.type,
        status: test.status,
        doctorName: prescription.doctor?.name,
        prescribedDate: prescription.uploadedAt,
        diagnosis: prescription.diagnosis,
      }))
  );

  return pendingTests;
};
export const completeTestService = async (
  prescriptionId: string,
  testId: string,
  userId: string,
  data: {
    reportKey: string;
    reportMimeType: string;
    resultSummary?: string;
    notes?: string;
    results: LabResult[];
    aiSummary: string | null;
  }
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  });

  if (!prescription) {
    await deleteReport(data.reportKey);
    throw createServiceError("Prescription not found or access denied", 404);
  }

  // Find test by _id in the array
  const testIndex = prescription.tests.findIndex(
    (t) => t._id?.toString() === testId
  );

  if (testIndex === -1) {
    await deleteReport(data.reportKey);
    throw createServiceError("Test not found in this prescription", 404);
  }

  const previousReport = prescription.tests[testIndex].reportUrl;
  prescription.tests[testIndex].status = "completed";
  prescription.tests[testIndex].completedDate = new Date();
  prescription.tests[testIndex].reportUrl = data.reportKey;
  prescription.tests[testIndex].reportMimeType = data.reportMimeType;
  // The patient's own words win; else the AI's reading of the report
  prescription.tests[testIndex].resultSummary = data.resultSummary?.trim() || data.aiSummary || null;
  prescription.tests[testIndex].results = data.results;
  prescription.tests[testIndex].aiSummary = data.aiSummary;
  prescription.tests[testIndex].notes = data.notes || null;

  await prescription.save();
  if (previousReport && previousReport !== data.reportKey) await deleteReport(previousReport);

  return {
    prescriptionId: prescription._id,
    test: prescription.tests[testIndex],
  };
};

// The owner's stored report for one test
export const getTestReportService = async (
  prescriptionId: string,
  testId: string,
  userId: string
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  })
    .select("tests")
    .lean();
  const test = prescription?.tests.find((t: any) => t._id?.toString() === testId);
  if (!test?.reportUrl) {
    throw createServiceError("Report not found", 404);
  }
  return { key: test.reportUrl, mimeType: test.reportMimeType || null };
};

export const getPrescriptionTestsService = async (
  prescriptionId: string,
  userId: string
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  })
    .select("tests doctor uploadedAt")
    .lean();

  if (!prescription) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  return {
    prescriptionId: prescription._id,
    doctorName: prescription.doctor?.name,
    prescribedDate: prescription.uploadedAt,
    tests: prescription.tests,
  };
};

export const getCompletedTestsService = async (userId: string) => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    "tests.status": "completed",
  })
    .select("_id doctor uploadedAt tests")
    .lean();

  const completedTests = prescriptions.flatMap((prescription) =>
    prescription.tests
      .filter((test: any) => test.status === "completed")
      .map((test: any) => ({
        prescriptionId: prescription._id,
        testId: test._id,
        testName: test.name,
        testType: test.type,
        status: test.status,
        completedDate: test.completedDate,
        hasReport: !!test.reportUrl,
        resultSummary: test.resultSummary,
        notes: test.notes,
        doctorName: prescription.doctor?.name,
        prescribedDate: prescription.uploadedAt,
      }))
  );

  return completedTests;
};

export const cancelTestService = async (
  prescriptionId: string,
  testId: string,
  userId: string,
  reason?: string
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  });
  if (!prescription) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  const test = prescription.tests.find((t) => t._id?.toString() === testId);
  if (!test) {
    throw createServiceError("Test not found in this prescription", 404);
  }
  if (test.status === "completed") {
    throw createServiceError("A completed test cannot be cancelled", 400);
  }

  test.status = "cancelled";
  test.notes = (typeof reason === "string" && reason.trim()) || "Cancelled by user";
  await prescription.save();

  return { prescriptionId: prescription._id, test };
};

export const areAllTestsCompletedService = async (
  prescriptionId: string,
  userId: string
): Promise<boolean> => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  })
    .select("tests")
    .lean();

  if (!prescription || prescription.tests.length === 0) {
    return true;
  }

  return prescription.tests.every(
    (test: any) => test.status === "completed" || test.status === "cancelled"
  );
};

export const getTestStatsService = async (userId: string) => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
  })
    .select("tests")
    .lean();

  const allTests = prescriptions.flatMap((p) => p.tests);

  return {
    total: allTests.length,
    pending: allTests.filter((t: any) => t.status === "pending").length,
    completed: allTests.filter((t: any) => t.status === "completed").length,
    cancelled: allTests.filter((t: any) => t.status === "cancelled").length,
  };
};

// ============================================
// NEW SERVICES - PRESCRIPTION COMPLETION
// ============================================

export const completePrescriptionService = async (
  prescriptionId: string,
  userId: string,
  feedbackData: {
    overallImprovement: number;
    symptomRelief: number;
    medicationEffectiveness: number;
    sideEffects: number;
    healthConditionNow: string;
    wasHelpful: boolean;
    sideEffectsDescription?: string;
    additionalComments?: string;
    wouldRecommend: boolean;
  }
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  });

  if (!prescription) {
    throw createServiceError("Prescription not found or access denied", 404);
  }

  if (prescription.isComplete) {
    throw new Error("Prescription is already marked as complete");
  }

  const feedback = await PrescriptionFeedbackModel.create({
    userId: new Types.ObjectId(userId),
    prescriptionId: new Types.ObjectId(prescriptionId),
    ...feedbackData,
  });

  prescription.isComplete = true;
  prescription.completedAt = new Date();
  prescription.isCurrent = false;
  await prescription.save();

  await ReminderModel.updateMany(
    { prescriptionId: new Types.ObjectId(prescriptionId) },
    { isActive: false }
  );

  console.log(`✅ Prescription ${prescriptionId} completed. Reminders paused.`);

  return {
    prescription,
    feedback,
  };
};

export const getPrescriptionFeedback = async (
  prescriptionId: string,
  userId: string
) => {
  return await PrescriptionFeedbackModel.findOne({
    prescriptionId: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  }).lean();
};

export const getClinicalSummaryService = async (userId: string) => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    status: "confirmed",
  })
    .sort({ uploadedAt: 1 })
    .lean();

  const feedbacks = await PrescriptionFeedbackModel.find({
    userId: new Types.ObjectId(userId),
  }).lean();

  const latestPrescription = prescriptions[prescriptions.length - 1];
  const patientInfo = {
    name: latestPrescription?.patient?.name || "N/A",
    age: latestPrescription?.patient?.age || "N/A",
    gender: latestPrescription?.patient?.gender || "N/A",
    contact: latestPrescription?.patient?.contact || "N/A",
  };

  const completedPrescriptions = prescriptions.filter((p) => p.isComplete).length;
  const activePrescriptions = prescriptions.filter(
    (p) => p.isCurrent && !p.isComplete
  ).length;

  const allMedicines = new Set<string>();
  prescriptions.forEach((p) => {
    p.medicines.forEach((m) => allMedicines.add(m.name));
  });

  const allTests = new Set<string>();
  prescriptions.forEach((p) => {
    p.tests.forEach((t) => allTests.add(t.name));
  });

  const startDate = prescriptions[0]?.uploadedAt || new Date();
  const endDate = prescriptions[prescriptions.length - 1]?.completedAt || null;
  const durationDays = endDate
    ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const treatmentOverview = {
    totalPrescriptions: prescriptions.length,
    completedPrescriptions,
    activePrescriptions,
    totalMedicines: allMedicines.size,
    totalTests: allTests.size,
    treatmentDuration: {
      startDate,
      endDate,
      durationDays,
    },
  };

  const healthProgression = prescriptions.map((prescription) => {
    const feedback = feedbacks.find(
      (f) => f.prescriptionId.toString() === prescription._id.toString()
    );

    return {
      date: prescription.uploadedAt,
      doctor: prescription.doctor?.name || "Unknown",
      diagnosis: prescription.diagnosis,
      symptoms: prescription.symptoms,
      medicines: prescription.medicines.map((m) => m.name),
      tests: prescription.tests.map((t) => t.name),
      feedback: feedback
        ? {
            improvement: feedback.overallImprovement,
            symptomRelief: feedback.symptomRelief,
            condition: feedback.healthConditionNow,
          }
        : undefined,
    };
  });

  const medicineUsage = new Map<string, { count: number; effectiveness: number[]; durations: string[] }>();
  prescriptions.forEach((prescription) => {
    const feedback = feedbacks.find(
      (f) => f.prescriptionId.toString() === prescription._id.toString()
    );

    prescription.medicines.forEach((medicine) => {
      const existing = medicineUsage.get(medicine.name);
      if (existing) {
        existing.count++;
        if (feedback) {
          existing.effectiveness.push(feedback.medicationEffectiveness);
        }
        if (medicine.duration) {
          existing.durations.push(medicine.duration);
        }
      } else {
        medicineUsage.set(medicine.name, {
          count: 1,
          effectiveness: feedback ? [feedback.medicationEffectiveness] : [],
          durations: medicine.duration ? [medicine.duration] : [],
        });
      }
    });
  });

  const medicationHistory = Array.from(medicineUsage.entries()).map(
    ([name, data]) => ({
      name,
      timesPrescribed: data.count,
      totalDuration: data.durations.join(", ") || "N/A",
      effectiveness:
        data.effectiveness.length > 0
          ? Math.round(
              data.effectiveness.reduce((a, b) => a + b, 0) /
                data.effectiveness.length
            )
          : undefined,
    })
  );

  const testHistory = prescriptions.flatMap((p) =>
    p.tests.map((test: any) => ({
      testName: test.name,
      testType: test.type || "N/A",
      prescribedDate: p.uploadedAt,
      doctorName: p.doctor?.name || "Unknown",
      status: test.status,
      completedDate: test.completedDate,
      resultSummary: test.resultSummary,
    }))
  );

  const latestDiagnosis = latestPrescription?.diagnosis || [];
  const latestSymptoms = latestPrescription?.symptoms || [];
  const activeMedicationsCount = prescriptions
    .filter((p) => p.isCurrent && !p.isComplete)
    .reduce((sum, p) => sum + p.medicines.length, 0);

  const avgImprovement =
    feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + f.overallImprovement, 0) /
        feedbacks.length
      : undefined;

  let overallProgress = "No data available";
  if (avgImprovement) {
    if (avgImprovement >= 4) overallProgress = "Excellent improvement";
    else if (avgImprovement >= 3) overallProgress = "Good improvement";
    else if (avgImprovement >= 2) overallProgress = "Moderate improvement";
    else overallProgress = "Limited improvement";
  }

  const currentHealthStatus = {
    latestDiagnosis,
    latestSymptoms,
    activeMedications: activeMedicationsCount,
    overallProgress,
    averageImprovement: avgImprovement,
  };

  const feedbackSummary = {
    totalFeedbacks: feedbacks.length,
    averageImprovement:
      feedbacks.length > 0
        ? Math.round(
            (feedbacks.reduce((sum, f) => sum + f.overallImprovement, 0) /
              feedbacks.length) *
              10
          ) / 10
        : 0,
    averageSymptomRelief:
      feedbacks.length > 0
        ? Math.round(
            (feedbacks.reduce((sum, f) => sum + f.symptomRelief, 0) /
              feedbacks.length) *
              10
          ) / 10
        : 0,
    averageMedicationEffectiveness:
      feedbacks.length > 0
        ? Math.round(
            (feedbacks.reduce((sum, f) => sum + f.medicationEffectiveness, 0) /
              feedbacks.length) *
              10
          ) / 10
        : 0,
    averageSideEffects:
      feedbacks.length > 0
        ? Math.round(
            (feedbacks.reduce((sum, f) => sum + f.sideEffects, 0) /
              feedbacks.length) *
              10
          ) / 10
        : 0,
    recommendationRate:
      feedbacks.length > 0
        ? Math.round(
            (feedbacks.filter((f) => f.wouldRecommend).length /
              feedbacks.length) *
              100
          )
        : 0,
  };

  return {
    patientInfo,
    treatmentOverview,
    healthProgression,
    medicationHistory,
    testHistory,
    currentHealthStatus,
    feedbackSummary,
  };
};
export interface ClinicalTimelinePeriod {
  periodLabel: string; // "Month 1", "Months 2-3", "Months 4-6", "Current"
  startDate: Date;
  endDate: Date;
  monthsFromStart: number;
  
  // What happened during this period
  prescriptions: Array<{
    id: string;
    date: Date;
    doctor: {
      name: string;
      specialization?: string;
    };
  }>;
  
  // Patient's condition
  symptoms: {
    reported: string[]; // All symptoms in this period
    new: string[]; // New symptoms not seen before
    continuing: string[]; // Symptoms from previous periods
    resolved: string[]; // Symptoms that were present before but not now
  };
  
  diagnosis: string[];
  
  // Medications prescribed
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
  
  // Tests during this period
  tests: {
    ordered: Array<{
      name: string;
      type?: string;
      orderedDate: Date;
    }>;
    completed: Array<{
      name: string;
      type?: string;
      completedDate: Date;
      resultSummary?: string;
      notes?: string;
    }>;
  };
  
  // Patient feedback (if prescription was completed)
  patientFeedback?: {
    overallImprovement: number; // 1-5
    symptomRelief: number; // 1-5
    medicationEffectiveness: number; // 1-5
    sideEffects: number; // 1-5 (1=severe, 5=none)
    sideEffectsDescription?: string;
    healthConditionNow: string;
    wasHelpful: boolean;
    wouldRecommend: boolean;
    additionalComments?: string;
  };
  
  clinicalNotes: string[]; // Auto-generated clinical observations
}

export interface TestResultsByType {
  testType: string;
  testName: string;
  results: Array<{
    date: Date;
    periodLabel: string;
    status: string;
    resultSummary?: string;
    notes?: string;
  }>;
}

export interface DetailedClinicalSummary {
  generatedAt: Date;
  
  // Patient demographics
  patientInfo: {
    name: string;
    age: string;
    gender: string;
    contact: string;
    allergies: string[];
  };

  // Treatment overview
  treatmentPeriod: {
    firstVisit: Date;
    lastVisit: Date;
    totalMonths: number;
    totalPrescriptions: number;
    totalDoctorsConsulted: number;
    activeTreatments: number;
    completedTreatments: number;
  };
  
  // Timeline of care (chronological)
  clinicalTimeline: ClinicalTimelinePeriod[];
  
  // Test results grouped by type
  testResultsSummary: TestResultsByType[];
  
  // Overall health progression
  healthProgressionSummary: {
    initialSymptoms: string[];
    currentSymptoms: string[];
    resolvedSymptoms: string[];
    persistentSymptoms: string[];
    
    baselineCondition: string; // First feedback description
    currentCondition: string; // Latest feedback description
    
    improvementTrend: {
      overallScore: number; // Average improvement rating
      trend: "improving" | "stable" | "declining" | "insufficient_data";
      progressionData: Array<{
        period: string;
        improvement: number;
        symptomRelief: number;
      }>;
    };
    
    sideEffectsHistory: {
      totalReported: number;
      averageSeverity: number; // 1-5
      descriptions: Array<{
        period: string;
        severity: number;
        description: string;
      }>;
    };
  };
  
  // Medication effectiveness
  medicationAnalysis: Array<{
    name: string;
    timesPrescribed: number;
    periods: string[];
    totalDuration: string;
    effectiveness?: number; // Average from feedback
    associatedSymptoms: string[];
  }>;
  
  // Clinical recommendations (auto-generated)
  clinicalObservations: string[];

  // Measured vitals per visit, oldest first (only visits with any vital)
  vitalsTrend: Array<{ date: string; written: Partial<Record<string, string | null>>; values: Record<string, number | null> }>;
}

// Helper: Calculate months difference
const getMonthsDifference = (start: Date, end: Date): number => {
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
  return months;
};

// Helper: Group prescriptions into time periods
const groupPrescriptionsByPeriods = (prescriptions: any[], startDate: Date) => {
  const periods: Map<string, any[]> = new Map();
  
  prescriptions.forEach(prescription => {
    const prescDate = new Date(prescription.uploadedAt);
    const monthsDiff = getMonthsDifference(startDate, prescDate);
    
    let periodKey: string;
    if (monthsDiff === 0) periodKey = "Month 1";
    else if (monthsDiff === 1) periodKey = "Month 2";
    else if (monthsDiff >= 2 && monthsDiff <= 3) periodKey = "Months 2-3";
    else if (monthsDiff >= 4 && monthsDiff <= 6) periodKey = "Months 4-6";
    else if (monthsDiff >= 7 && monthsDiff <= 12) periodKey = "Months 7-12";
    else periodKey = `Month ${monthsDiff + 1}`;
    
    if (!periods.has(periodKey)) {
      periods.set(periodKey, []);
    }
    periods.get(periodKey)!.push(prescription);
  });
  
  return periods;
};

export const getDetailedClinicalSummaryService = async (
  userId: string
): Promise<DetailedClinicalSummary> => {
  // Fetch all prescriptions and feedbacks
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
    ...profileFilter(),
    status: "confirmed",
  })
    .sort({ uploadedAt: 1 })
    .lean();

  if (prescriptions.length === 0) {
    throw createServiceError("No prescriptions found for this user", 404);
  }

  const feedbacks = await PrescriptionFeedbackModel.find({
    userId: new Types.ObjectId(userId),
  }).lean();

  // Create feedback map for quick lookup
  const feedbackMap = new Map(
    feedbacks.map(f => [f.prescriptionId.toString(), f])
  );

  // === PATIENT INFO ===
  const latestPrescription = prescriptions[prescriptions.length - 1];
  const patientInfo = {
    name: latestPrescription.patient?.name || "N/A",
    age: latestPrescription.patient?.age || "N/A",
    gender: latestPrescription.patient?.gender || "N/A",
    contact: latestPrescription.patient?.contact || "N/A",
    allergies: mergeAllergies(await allergiesOf(userId), prescriptions.flatMap((p) => p.allergies ?? [])),
  };

  // === TREATMENT PERIOD ===
  const firstVisit = new Date(prescriptions[0].uploadedAt);
  const lastVisit = new Date(prescriptions[prescriptions.length - 1].uploadedAt);
  const totalMonths = getMonthsDifference(firstVisit, lastVisit);
  
  const uniqueDoctors = new Set(
    prescriptions.map(p => p.doctor?.name).filter(Boolean)
  );

  const treatmentPeriod = {
    firstVisit,
    lastVisit,
    totalMonths,
    totalPrescriptions: prescriptions.length,
    totalDoctorsConsulted: uniqueDoctors.size,
    activeTreatments: prescriptions.filter(p => p.isCurrent && !p.isComplete).length,
    completedTreatments: prescriptions.filter(p => p.isComplete).length,
  };

  // === BUILD CLINICAL TIMELINE ===
  const periodGroups = groupPrescriptionsByPeriods(prescriptions, firstVisit);
  const clinicalTimeline: ClinicalTimelinePeriod[] = [];
  
  const allSymptomsSoFar = new Set<string>();
  
  for (const [periodLabel, periodPrescriptions] of periodGroups) {
    const periodStart = new Date(periodPrescriptions[0].uploadedAt);
    const periodEnd = new Date(periodPrescriptions[periodPrescriptions.length - 1].uploadedAt);
    const monthsFromStart = getMonthsDifference(firstVisit, periodStart);
    
    // Collect all symptoms in this period
    const periodSymptoms = new Set<string>();
    periodPrescriptions.forEach(p => {
      p.symptoms.forEach((s: string) => periodSymptoms.add(s));
    });
    
    // Determine new vs continuing symptoms
    const newSymptoms = Array.from(periodSymptoms).filter(s => !allSymptomsSoFar.has(s));
    const continuingSymptoms = Array.from(periodSymptoms).filter(s => allSymptomsSoFar.has(s));
    
    // Add to all symptoms seen
    periodSymptoms.forEach(s => allSymptomsSoFar.add(s));
    
    // Collect diagnosis
    const diagnosisSet = new Set<string>();
    periodPrescriptions.forEach(p => {
      p.diagnosis.forEach((d: string) => diagnosisSet.add(d));
    });
    
    // Collect medications
    const medications: any[] = [];
    periodPrescriptions.forEach(p => {
      p.medicines.forEach((m: any) => {
        medications.push({
          name: m.name,
          dosage: m.dosage || "N/A",
          frequency: m.frequency || "N/A",
          duration: m.duration || "N/A",
          instructions: m.instructions,
        });
      });
    });
    
    // Collect tests
    const orderedTests: any[] = [];
    const completedTests: any[] = [];
    
    periodPrescriptions.forEach(p => {
      p.tests.forEach((test: any) => {
        orderedTests.push({
          name: test.name,
          type: test.type,
          orderedDate: p.uploadedAt,
        });
        
        if (test.status === "completed") {
          const outOfRange = (test.results ?? [])
            .filter((r: LabResult) => r.flag === "high" || r.flag === "low")
            .map((r: LabResult) => `${r.name} ${r.value}${r.unit ? " " + r.unit : ""} (${r.flag})`);
          completedTests.push({
            name: test.name,
            type: test.type,
            completedDate: test.completedDate,
            resultSummary: [test.resultSummary, outOfRange.length ? `Out of range: ${outOfRange.join(", ")}` : null]
              .filter(Boolean)
              .join(". "),
            notes: test.notes,
          });
        }
      });
    });
    
    // Get feedback (use most recent completed prescription in period)
    let patientFeedback: any = undefined;
    for (const p of periodPrescriptions.reverse()) {
      const feedback = feedbackMap.get(p._id.toString());
      if (feedback) {
        patientFeedback = {
          overallImprovement: feedback.overallImprovement,
          symptomRelief: feedback.symptomRelief,
          medicationEffectiveness: feedback.medicationEffectiveness,
          sideEffects: feedback.sideEffects,
          sideEffectsDescription: feedback.sideEffectsDescription,
          healthConditionNow: feedback.healthConditionNow,
          wasHelpful: feedback.wasHelpful,
          wouldRecommend: feedback.wouldRecommend,
          additionalComments: feedback.additionalComments,
        };
        break;
      }
    }
    periodPrescriptions.reverse(); // Restore order
    
    // Generate clinical notes
    const clinicalNotes: string[] = [];
    
    if (newSymptoms.length > 0) {
      clinicalNotes.push(`New symptoms reported: ${newSymptoms.join(", ")}`);
    }
    if (continuingSymptoms.length > 0) {
      clinicalNotes.push(`Continuing symptoms: ${continuingSymptoms.join(", ")}`);
    }
    if (medications.length > 0) {
      clinicalNotes.push(`Prescribed ${medications.length} medication(s)`);
    }
    if (completedTests.length > 0) {
      clinicalNotes.push(`${completedTests.length} test(s) completed`);
    }
    if (patientFeedback) {
      clinicalNotes.push(`Patient improvement rating: ${patientFeedback.overallImprovement}/5`);
      if (patientFeedback.sideEffects < 4) {
        clinicalNotes.push(`Side effects reported (severity: ${6 - patientFeedback.sideEffects}/5)`);
      }
    }
    
    clinicalTimeline.push({
      periodLabel,
      startDate: periodStart,
      endDate: periodEnd,
      monthsFromStart,
      prescriptions: periodPrescriptions.map(p => ({
        id: p._id.toString(),
        date: p.uploadedAt,
        doctor: {
          name: p.doctor?.name || "Unknown",
          specialization: p.doctor?.specialization,
        },
      })),
      symptoms: {
        reported: Array.from(periodSymptoms),
        new: newSymptoms,
        continuing: continuingSymptoms,
        resolved: [], // Will calculate in next iteration
      },
      diagnosis: Array.from(diagnosisSet),
      medications,
      tests: {
        ordered: orderedTests,
        completed: completedTests,
      },
      patientFeedback,
      clinicalNotes,
    });
  }
  
  // Calculate resolved symptoms for each period
  for (let i = 0; i < clinicalTimeline.length - 1; i++) {
    const currentPeriod = clinicalTimeline[i];
    const nextPeriod = clinicalTimeline[i + 1];
    
    const currentSymptoms = new Set(currentPeriod.symptoms.reported);
    const nextSymptoms = new Set(nextPeriod.symptoms.reported);
    
    const resolved = Array.from(currentSymptoms).filter(s => !nextSymptoms.has(s));
    nextPeriod.symptoms.resolved = resolved;
  }
  
  // === TEST RESULTS GROUPED BY TYPE ===
  const testsByType = new Map<string, any[]>();
  
  clinicalTimeline.forEach(period => {
    period.tests.completed.forEach(test => {
      const key = test.type || test.name;
      if (!testsByType.has(key)) {
        testsByType.set(key, []);
      }
      testsByType.get(key)!.push({
        name: test.name,
        date: test.completedDate,
        periodLabel: period.periodLabel,
        status: "completed",
        resultSummary: test.resultSummary,
        notes: test.notes,
      });
    });
  });
  
  const testResultsSummary: TestResultsByType[] = Array.from(testsByType.entries()).map(
    ([testType, results]) => ({
      testType,
      testName: results[0]?.name || testType,
      results: results
        .map(({ name, ...r }) => r)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    })
  );
  
  // === HEALTH PROGRESSION SUMMARY ===
  const initialSymptoms = clinicalTimeline[0]?.symptoms.reported || [];
  const currentSymptoms = clinicalTimeline[clinicalTimeline.length - 1]?.symptoms.reported || [];
  
  const allSymptomsEver = new Set<string>();
  clinicalTimeline.forEach(p => p.symptoms.reported.forEach(s => allSymptomsEver.add(s)));
  
  const resolvedSymptoms = Array.from(allSymptomsEver).filter(s => !currentSymptoms.includes(s));
  const persistentSymptoms = initialSymptoms.filter(s => currentSymptoms.includes(s));
  
  const baselineCondition = feedbacks[0]?.healthConditionNow || "No baseline data";
  const currentCondition = feedbacks[feedbacks.length - 1]?.healthConditionNow || "No current data";
  
  // Calculate improvement trend
  const progressionData = clinicalTimeline
    .filter(p => p.patientFeedback)
    .map(p => ({
      period: p.periodLabel,
      improvement: p.patientFeedback!.overallImprovement,
      symptomRelief: p.patientFeedback!.symptomRelief,
    }));
  
  const avgImprovement = progressionData.length > 0
    ? progressionData.reduce((sum, p) => sum + p.improvement, 0) / progressionData.length
    : 0;
  
  let trend: "improving" | "stable" | "declining" | "insufficient_data" = "insufficient_data";
  if (progressionData.length >= 2) {
    const first = progressionData[0].improvement;
    const last = progressionData[progressionData.length - 1].improvement;
    if (last > first + 0.5) trend = "improving";
    else if (last < first - 0.5) trend = "declining";
    else trend = "stable";
  } else if (progressionData.length === 1) {
    // Single feedback — use score to estimate
    const score = progressionData[0].improvement;
    trend = score >= 4 ? "improving" : score >= 3 ? "stable" : "declining";
  }
  
  // Side effects history
  const sideEffectsDescriptions = clinicalTimeline
    .filter(p => p.patientFeedback && p.patientFeedback.sideEffectsDescription)
    .map(p => ({
      period: p.periodLabel,
      severity: 6 - p.patientFeedback!.sideEffects, // Invert scale (1=none, 5=severe)
      description: p.patientFeedback!.sideEffectsDescription || "",
    }));
  
  const avgSeverity = sideEffectsDescriptions.length > 0
    ? sideEffectsDescriptions.reduce((sum, s) => sum + s.severity, 0) / sideEffectsDescriptions.length
    : 0;
  
  const healthProgressionSummary = {
    initialSymptoms,
    currentSymptoms,
    resolvedSymptoms,
    persistentSymptoms,
    baselineCondition,
    currentCondition,
    improvementTrend: {
      overallScore: Math.round(avgImprovement * 10) / 10,
      trend,
      progressionData,
    },
    sideEffectsHistory: {
      totalReported: sideEffectsDescriptions.length,
      averageSeverity: Math.round(avgSeverity * 10) / 10,
      descriptions: sideEffectsDescriptions,
    },
  };
  
  // === MEDICATION ANALYSIS ===
  const medicineUsage = new Map<string, any>();
  
  clinicalTimeline.forEach(period => {
    period.medications.forEach(med => {
      if (!medicineUsage.has(med.name)) {
        medicineUsage.set(med.name, {
          name: med.name,
          timesPrescribed: 0,
          periods: [],
          durations: [],
          effectiveness: [],
          associatedSymptoms: new Set<string>(),
        });
      }
      
      const usage = medicineUsage.get(med.name);
      usage.timesPrescribed++;
      usage.periods.push(period.periodLabel);
      if (med.duration) usage.durations.push(med.duration);
      if (period.patientFeedback) {
        usage.effectiveness.push(period.patientFeedback.medicationEffectiveness);
      }
      period.symptoms.reported.forEach(s => usage.associatedSymptoms.add(s));
    });
  });
  
  const medicationAnalysis = Array.from(medicineUsage.values()).map(m => ({
    name: m.name,
    timesPrescribed: m.timesPrescribed,
    periods: m.periods,
    totalDuration: m.durations.join(", ") || "N/A",
    effectiveness: m.effectiveness.length > 0
      ? Math.round((m.effectiveness.reduce((a: number, b: number) => a + b, 0) / m.effectiveness.length) * 10) / 10
      : undefined,
     associatedSymptoms: Array.from(m.associatedSymptoms) as string[],
  }));
  
  // === CLINICAL OBSERVATIONS ===
  const clinicalObservations: string[] = [];
  
  if (trend === "improving") {
    clinicalObservations.push("Patient shows positive response to treatment with overall improvement in condition.");
  } else if (trend === "declining") {
    clinicalObservations.push("Patient condition shows declining trend. Consider treatment reassessment.");
  }
  
  if (resolvedSymptoms.length > 0) {
    clinicalObservations.push(`${resolvedSymptoms.length} symptom(s) have resolved: ${resolvedSymptoms.slice(0, 3).join(", ")}`);
  }
  
  if (persistentSymptoms.length > 0) {
    clinicalObservations.push(`${persistentSymptoms.length} persistent symptom(s) require continued monitoring: ${persistentSymptoms.slice(0, 3).join(", ")}`);
  }
  
  if (avgSeverity > 2) {
    clinicalObservations.push(`Significant side effects reported. Average severity: ${avgSeverity}/5`);
  }
  
  const highEffectiveness = medicationAnalysis.filter(m => m.effectiveness && m.effectiveness >= 4);
  if (highEffectiveness.length > 0) {
    clinicalObservations.push(`Highly effective medications: ${highEffectiveness.map(m => m.name).slice(0, 3).join(", ")}`);
  }
  
  const vitalsTrend = prescriptions
    .filter((p) => p.vitals)
    .map((p) => {
      const { values, ...written } = p.vitals as any;
      return {
        date: p.prescriptionDate || ymdInAppTz(new Date(p.uploadedAt)),
        written,
        values: values ?? {},
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    generatedAt: new Date(),
    patientInfo,
    treatmentPeriod,
    clinicalTimeline,
    testResultsSummary,
    healthProgressionSummary,
    medicationAnalysis,
    clinicalObservations,
    vitalsTrend,
  };
};
export const generateClinicalSummaryPDFService = async (
  userId: string
): Promise<Buffer> => {
  const summary = await getDetailedClinicalSummaryService(userId);
  const adherence = await getAdherenceService(userId, 30);
  const narrative =
    (await getClinicalNarrativeService(userId, summary)) ??
    "The written clinical narrative could not be generated right now. Please try again later.";

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      registerPdfFonts(doc);

      // Header
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('Clinical Summary Report', { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Generated: ${new Date().toLocaleString('en-GB', { timeZone: appConfig.APP_TIMEZONE })}`,
          { align: 'center' }
        )
        .moveDown(0.5);

      // Horizontal line
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1);

      // Patient Info
      doc.fontSize(12).font('Helvetica-Bold').text('Patient Information').moveDown(0.3);
      doc.fontSize(10);
      writeMixed(doc, `Name: ${summary.patientInfo.name}`);
      writeMixed(doc, `Age: ${formatAge(summary.patientInfo.age)}`);
      writeMixed(doc, `Gender: ${formatGender(summary.patientInfo.gender)}`);
      writeMixed(doc, `Contact: ${summary.patientInfo.contact}`);
      writeMixed(doc, `Allergies: ${summary.patientInfo.allergies.join(', ') || 'None recorded'}`, {
        bold: summary.patientInfo.allergies.length > 0,
      });
      doc.moveDown(1);

      if (adherence.percent !== null) {
        doc.fontSize(12).font('Helvetica-Bold').text('Medicine Adherence (last 30 days)').moveDown(0.3);
        doc.fontSize(10).font('Helvetica')
          .text(`${adherence.percent}% of doses marked as taken (${adherence.taken} of ${adherence.scheduled})`);
        const missed = adherence.perMedicine.filter((m) => m.percent !== null && m.percent < 80);
        if (missed.length) {
          writeMixed(doc, `Most missed: ${missed.slice(0, 3).map((m) => `${m.name} (${m.percent}%)`).join(', ')}`);
        }
        doc.moveDown(1);
      }

      if (summary.vitalsTrend.length) {
        doc.fontSize(12).font('Helvetica-Bold').text('Vitals by Visit').moveDown(0.3);
        doc.fontSize(10);
        for (const v of summary.vitalsTrend) {
          const parts = Object.entries(VITAL_LABELS)
            .filter(([k]) => v.written[k])
            .map(([k, label]) => `${label} ${v.written[k]}`);
          writeMixed(doc, `${v.date}:  ${parts.join('  ·  ')}`);
        }
        doc.moveDown(1);
      }

      // Horizontal line
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1);

      // AI-Generated Clinical Narrative
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Clinical Narrative', { underline: true })
        .moveDown(0.5);

      writeMarkdownToPdf(doc, narrative);

      doc.moveDown(2);

      // Footer
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor('gray')
        .text(
          'This is a computer-generated clinical summary. For medical decisions, please consult with your healthcare provider.',
          {
            align: 'center',
          }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
// Narrative for this exact summary data: cached, else generated and cached.
// Returns null (not an error) when Gemini is unavailable, so the summary still loads.
export const getClinicalNarrativeService = async (
  userId: string,
  summaryData: DetailedClinicalSummary
): Promise<string | null> => {
  const { generatedAt, ...stable } = summaryData;
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex");

  // One cached narrative per person
  const key = { userId: new Types.ObjectId(userId), ...profileFilter() };
  const cached = await ClinicalNarrativeModel.findOne(key).lean();
  if (cached?.fingerprint === fingerprint) return cached.narrative;

  try {
    const narrative = await generateAIClinicalNarrativeService(userId, summaryData);
    await ClinicalNarrativeModel.updateOne(
      key,
      { fingerprint, narrative, generatedAt: new Date() },
      { upsert: true }
    );
    return narrative;
  } catch (error) {
    console.error("❌ Clinical narrative unavailable:", error);
    // Better an older narrative than none
    return cached?.narrative ?? null;
  }
};

export const generateAIClinicalNarrativeService = async (
  userId: string,
  summary?: DetailedClinicalSummary
): Promise<string> => {
  const summaryData = summary ?? (await getDetailedClinicalSummaryService(userId));

  // Create a prompt for Gemini to generate narrative clinical notes
  const prompt = `
You are a medical scribe writing clinical notes strictly from provided data.
CRITICAL RULES:
- ONLY use information explicitly present in the data below
- Do NOT infer, guess, or add any medical information not in the data
- If a field is missing/null/empty, skip it — do not substitute or assume
- Do NOT add diagnoses, medications, or symptoms not listed
- Do NOT give medical advice or recommendations beyond what doctors already prescribed
- Write in simple, clear language (not overly technical) so patients can understand

**Patient Information:**
- Name: ${summaryData.patientInfo.name}
- Age: ${summaryData.patientInfo.age}
- Gender: ${summaryData.patientInfo.gender}
- Known allergies: ${summaryData.patientInfo.allergies.join(', ') || 'None recorded'}

**Treatment Period:**
- First Visit: ${new Date(summaryData.treatmentPeriod.firstVisit).toLocaleDateString()}
- Last Visit: ${new Date(summaryData.treatmentPeriod.lastVisit).toLocaleDateString()}
- Duration: ${summaryData.treatmentPeriod.totalMonths} months
- Total Prescriptions: ${summaryData.treatmentPeriod.totalPrescriptions}
- Doctors Consulted: ${summaryData.treatmentPeriod.totalDoctorsConsulted}

**Clinical Timeline:**
${summaryData.clinicalTimeline.map((period) => `
${period.periodLabel} (${new Date(period.startDate).toLocaleDateString()}):
- Doctor(s): ${period.prescriptions.map(p => `${p.doctor.name} (${p.doctor.specialization})`).join(', ')}
- Symptoms Reported: ${period.symptoms.reported.join(', ')}
${period.symptoms.new.length > 0 ? `- New Symptoms: ${period.symptoms.new.join(', ')}` : ''}
${period.symptoms.resolved.length > 0 ? `- Resolved Symptoms: ${period.symptoms.resolved.join(', ')}` : ''}
- Diagnosis: ${period.diagnosis.join(', ')}
- Medications Prescribed (${period.medications.length}): ${period.medications.slice(0, 5).map(m => `${m.name} ${m.dosage}`).join(', ')}
${period.tests.completed.length > 0 ? `- Tests Completed: ${period.tests.completed.map(t => `${t.name}${t.resultSummary ? ' - ' + t.resultSummary : ''}`).join(', ')}` : ''}
${period.patientFeedback ? `
- Patient Feedback:
  * Overall Improvement: ${period.patientFeedback.overallImprovement}/5
  * Symptom Relief: ${period.patientFeedback.symptomRelief}/5
  * Medication Effectiveness: ${period.patientFeedback.medicationEffectiveness}/5
  * Side Effects: ${period.patientFeedback.sideEffects}/5
  * Current Condition: ${period.patientFeedback.healthConditionNow}
` : ''}
`).join('\n')}

**Health Progression:**
- Initial Symptoms: ${summaryData.healthProgressionSummary.initialSymptoms.join(', ')}
- Current Symptoms: ${summaryData.healthProgressionSummary.currentSymptoms.join(', ')}
- Resolved Symptoms: ${summaryData.healthProgressionSummary.resolvedSymptoms.join(', ') || 'None'}
- Persistent Symptoms: ${summaryData.healthProgressionSummary.persistentSymptoms.join(', ')}
- Baseline Condition: ${summaryData.healthProgressionSummary.baselineCondition}
- Current Condition: ${summaryData.healthProgressionSummary.currentCondition}
- Overall Improvement Trend: ${summaryData.healthProgressionSummary.improvementTrend.trend}
- Average Improvement Score: ${summaryData.healthProgressionSummary.improvementTrend.overallScore}/5

**Test Results:**
${summaryData.testResultsSummary.map(test => `
- ${test.testType}:
${test.results.map(r => `  * ${new Date(r.date).toLocaleDateString()}: ${r.resultSummary || r.status}`).join('\n')}
`).join('\n')}

**Medication Analysis:**
Top Medications:
${summaryData.medicationAnalysis.slice(0, 10).map(med => `
- ${med.name}: Prescribed ${med.timesPrescribed} time(s)${med.effectiveness ? `, Effectiveness: ${med.effectiveness}/5` : ''}
`).join('')}

**Clinical Observations:**
${summaryData.clinicalObservations.map((obs, i) => `${i + 1}. ${obs}`).join('\n')}

**Vitals by visit (as written):**
${summaryData.vitalsTrend.length
  ? summaryData.vitalsTrend
      .map((v) => `- ${v.date}: ${Object.entries(v.written).filter(([, x]) => x).map(([k, x]) => `${k} ${x}`).join(', ')}`)
      .join('\n')
  : 'None recorded'}

---

Please write a detailed, professional clinical narrative summary (500-800 words) that:
1. Provides a chronological overview of the patient's treatment journey
2. Highlights key symptoms, diagnoses, and treatment approaches
3. Discusses medication effectiveness and any side effects
4. Analyzes test results and their clinical significance
5. Evaluates overall health progression and patient response to treatment
6. Provides clinical insights and potential recommendations for ongoing care

Write in a professional medical tone suitable for clinical documentation. Use proper medical terminology and maintain HIPAA-compliant language.

FORMAT: plain text only. Put each section title on its own line. Do NOT use markdown symbols such as #, *, **, or ---. Finish every sentence; keep the whole summary under 600 words.
`;

  // Call Gemini API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${appConfig.GEMINI_MODEL}:generateContent?key=${appConfig.GEMINI_API_KEY}`;

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
      // Factual summary: low temperature. Large budget because the model's internal
      // reasoning also counts against the limit (2048 truncated the visible text).
      temperature: 0.2,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();

    const narrativeText: string = (data.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p.text || "")
      .join("")
      .trim();
    if (!narrativeText) {
      throw new Error("Invalid response from Gemini API");
    }

    return narrativeText;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Clinical narrative generation failed: ${error.message}`);
    }
    throw new Error("Clinical narrative generation failed: Unknown error");
  }
};

// ---------- PDF text helpers ----------
// Helvetica has no Bangla glyphs, and names/symptoms are stored in Bangla as
// written, so Bangla runs are drawn with Noto Sans Bengali.
const PDF_FONT_DIR = path.resolve(process.cwd(), "assets/fonts");
const BN_FONT = { regular: "NotoSansBengali-Regular.ttf", bold: "NotoSansBengali-Bold.ttf" };
let bnFontsAvailable: boolean | null = null;

function registerPdfFonts(doc: any) {
  if (bnFontsAvailable === null) {
    bnFontsAvailable = Object.values(BN_FONT).every((f) => fs.existsSync(path.join(PDF_FONT_DIR, f)));
    if (!bnFontsAvailable) console.warn(`⚠️ Bangla PDF fonts missing in ${PDF_FONT_DIR}`);
  }
  if (bnFontsAvailable) {
    doc.registerFont("bn", path.join(PDF_FONT_DIR, BN_FONT.regular));
    doc.registerFont("bn-bold", path.join(PDF_FONT_DIR, BN_FONT.bold));
  }
}

// Bangla letters plus the spaces/dandas between them form one run (the Bengali
// font has no ASCII punctuation, so commas etc. stay in Helvetica)
// ZWNJ/ZWJ (U+200C/D) shape Bangla conjuncts, so they belong to the run.
const BANGLA_RUN = /([ঀ-৿](?:[ঀ-৿।॥‌‍ ]*[ঀ-৿।॥])?)/;

function writeMixed(doc: any, raw: string, opts: { bold?: boolean } & Record<string, any> = {}) {
  const { bold, ...options } = opts;
  const latin = bold ? "Helvetica-Bold" : "Helvetica";
  // Invisible characters Helvetica would draw as boxes
  const text = raw.replace(/[​⁠﻿]/g, "").replace(/[‌‍](?![ঀ-৿])/g, "");
  const parts = bnFontsAvailable ? text.split(BANGLA_RUN).filter((p) => p !== "") : [text];
  if (parts.length === 0) parts.push("");
  parts.forEach((part, i) => {
    const isBangla = bnFontsAvailable && /^[ঀ-৿]/.test(part);
    doc.font(isBangla ? (bold ? "bn-bold" : "bn") : latin).text(part, {
      ...options,
      continued: i < parts.length - 1,
    });
  });
}

const VITAL_LABELS: Record<string, string> = {
  bp: "BP",
  pulse: "Pulse",
  temperature: "Temp",
  weight: "Weight",
  spo2: "SpO2",
  bloodSugar: "Sugar",
};

const formatAge = (age: string | null | undefined) => {
  const a = (age ?? "").trim();
  if (!a || a === "N/A") return "Not stated";
  return /^\d+(\.\d+)?$/.test(a) ? `${a} years` : a;
};

const formatGender = (g: string | null | undefined) =>
  g === "M" ? "Male" : g === "F" ? "Female" : "Not stated";

// Gemini returns light Markdown; render headings/bullets/bold instead of printing raw ** and #
function writeMarkdownToPdf(doc: any, markdown: string) {
  const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*\*/g, "").trim();

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      doc.moveDown(0.4);
      continue;
    }

    const heading =
      line.match(/^#{1,6}\s+(.+)$/) || line.match(/^\*\*([^*]+)\*\*:?$/);
    if (heading) {
      doc.moveDown(0.3).fontSize(12).fillColor("black");
      writeMixed(doc, clean(heading[1]).replace(/:$/, ""), { bold: true, lineGap: 3 });
      continue;
    }

    const bullet = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
    const text = clean(bullet ? `• ${bullet[1]}` : line);
    doc.fontSize(11).fillColor("black");
    writeMixed(doc, text, { lineGap: 4, indent: bullet ? 10 : 0 });
  }
}
