import {
  IDoctorInfo,
  IFollowUp,
  IMedicine,
  IPatientInfo,
  ITest,
  MEAL_TIMINGS,
  MEDICINE_FORMS,
  MealTiming,
  MedicineForm,
  MedicineScheduleType,
  SCHEDULE_TYPES,
} from "../models/prescription.model";
import {
  detectForm,
  detectMealTiming,
  parseDosageSchedule,
  parseDuration,
  parseFollowUpDays,
} from "../lib/dosageParser";
import { addDaysYmd, isValidYmd, ymdInAppTz } from "../lib/appDate";
import { IVitals, normalizeVitals } from "../lib/vitals";
import { cleanAllergies } from "../lib/allergies";

export interface NormalizedMedicine extends IMedicine {
  name: string;
  genericName: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  form: MedicineForm | null;
  schedule: { morning: boolean; noon: boolean; night: boolean };
  scheduleType: MedicineScheduleType;
  weekDays: number[];
  durationDays: number | null;
  continueIndefinitely: boolean;
  mealTiming: MealTiming | null;
}

export interface ParsedPrescription {
  doctor: IDoctorInfo;
  patient: IPatientInfo;
  symptoms: string[];
  diagnosis: string[];
  tests: ITest[];
  medicines: NormalizedMedicine[];
  notes: string | null;
  followUp: IFollowUp | null;
  prescriptionDate: string | null;
  vitals: IVitals | null;
  allergies: string[];
}

/**
 * A prescription date we can count from: a real YYYY-MM-DD, not in the future
 * (a future date is usually a day/month mix-up) and not absurdly old.
 */
export const normalizePrescriptionDate = (v: unknown): string | null => {
  if (!isValidYmd(v)) return null;
  if (v > ymdInAppTz() || v < "2000-01-01") return null;
  return v;
};

export const validatePrescriptionParsedData = (data: any): data is ParsedPrescription => {
  if (!data || typeof data !== "object") return false;
  // followUp is optional (filled in by normalisation when missing)
  const requiredFields = ["doctor", "patient", "symptoms", "diagnosis", "tests", "medicines", "notes"];

  if (!requiredFields.every((field) => field in data)) {
    return false;
  }

  if (!Array.isArray(data.symptoms) || !Array.isArray(data.diagnosis)) {
    return false;
  }

  if (!Array.isArray(data.medicines) || !Array.isArray(data.tests)) {
    return false;
  }

  if (!data.medicines.every((med: any) => med && typeof med.name === "string")) {
    return false;
  }

  return true;
};

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------
const strOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s && s.toLowerCase() !== "null" ? s : null;
};

const toBool = (v: unknown): boolean | undefined => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return undefined;
};

const toPositiveInt = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n);
};

const toEnum = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase().replace(/[\s-]+/g, "_") as T;
  return allowed.includes(s) ? s : undefined;
};

const toWeekDays = (v: unknown): number[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const days = v
    .map((d) => (typeof d === "number" ? d : parseInt(String(d), 10)))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
};

const toSchedule = (v: any): { morning: boolean; noon: boolean; night: boolean } | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const morning = toBool(v.morning);
  const noon = toBool(v.noon);
  const night = toBool(v.night);
  if (morning === undefined && noon === undefined && night === undefined) return undefined;
  return { morning: !!morning, noon: !!noon, night: !!night };
};

export interface NormalizeMedicineOptions {
  /**
   * When a "daily" medicine arrives with every slot false, re-derive the slots
   * from the text. Used for AI output (model slip); not for user-saved data,
   * where unchecking every slot is a deliberate choice.
   */
  fillEmptyDaily?: boolean;
}

/**
 * Validate/coerce one medicine into the current contract. Any structured field
 * that is missing or invalid is derived from the free text with the rule-based
 * parser, so old app versions / old stored prescriptions keep working.
 *
 * Weekly with no weekday stated keeps weekDays = [] ("once a week, day not
 * specified"); reminders then use the weekday the prescription was saved on.
 */
export const normalizeMedicine = (
  raw: any,
  opts: NormalizeMedicineOptions = {}
): NormalizedMedicine => {
  const m = raw && typeof raw.toObject === "function" ? raw.toObject() : raw || {};
  const name = strOrNull(m.name) || "";
  const dosage = strOrNull(m.dosage);
  const frequency = strOrNull(m.frequency);
  const duration = strOrNull(m.duration);
  const instructions = strOrNull(m.instructions);

  // Frequency first (it usually carries the pattern), then dosage, then instructions
  const scheduleText = [frequency, dosage, instructions].filter(Boolean).join(" | ");
  const derived = parseDosageSchedule(scheduleText);

  let scheduleType = toEnum(m.scheduleType, SCHEDULE_TYPES) ?? derived.scheduleType;
  let schedule = toSchedule(m.schedule);
  const scheduleGiven = !!schedule;
  if (!schedule) schedule = { morning: derived.morning, noon: derived.noon, night: derived.night };

  let weekDays = toWeekDays(m.weekDays) ?? [];
  if (scheduleType === "weekly" && weekDays.length === 0) weekDays = derived.weekDays;

  if (scheduleType === "as_needed" || scheduleType === "once") {
    schedule = { morning: false, noon: false, night: false };
  }
  if (scheduleType !== "weekly") weekDays = [];

  const anySlot = () => schedule!.morning || schedule!.noon || schedule!.night;
  if (scheduleType === "weekly" && !anySlot()) {
    schedule = { morning: true, noon: false, night: false };
  }
  if (scheduleType === "daily" && !anySlot() && (!scheduleGiven || opts.fillEmptyDaily)) {
    // AI said daily but set no slot (or nothing given): fall back to the text
    if (derived.scheduleType === "daily" && derived.totalDoses > 0) {
      schedule = { morning: derived.morning, noon: derived.noon, night: derived.night };
    } else if (derived.scheduleType !== "daily") {
      scheduleType = derived.scheduleType;
      weekDays = derived.weekDays;
      if (scheduleType === "weekly") {
        schedule = { morning: derived.morning || !(derived.noon || derived.night), noon: derived.noon, night: derived.night };
      }
    }
  }

  // Duration: the duration field first, then the dosing text (taper lines often
  // carry "x 5 days, then ... x 5 days" there)
  let derivedDuration = parseDuration(duration);
  if (derivedDuration.days === null && !derivedDuration.continueIndefinitely) {
    derivedDuration = parseDuration(scheduleText);
  }
  let continueIndefinitely = toBool(m.continueIndefinitely);
  let durationDays = toPositiveInt(m.durationDays) ?? null;
  if (durationDays === null && !continueIndefinitely) {
    durationDays = derivedDuration.days;
    if (durationDays === null && derivedDuration.continueIndefinitely) continueIndefinitely = true;
  }
  if (continueIndefinitely) durationDays = null;
  if (durationDays !== null && durationDays > 3650) durationDays = 3650;

  const form =
    toEnum(m.form, MEDICINE_FORMS) ?? detectForm([name, dosage, frequency].filter(Boolean).join(" "));
  const mealTiming = toEnum(m.mealTiming, MEAL_TIMINGS) ?? detectMealTiming(scheduleText);

  return {
    name,
    genericName: strOrNull(m.genericName),
    dosage,
    frequency,
    duration,
    instructions,
    form: form ?? null,
    schedule,
    scheduleType,
    weekDays,
    durationDays: durationDays ?? null,
    continueIndefinitely: !!continueIndefinitely,
    mealTiming: mealTiming ?? null,
  };
};

/**
 * Validate/coerce followUp. Falls back to scanning `fallbackText` (notes / OCR
 * text) for "৭ দিন পর আবার দেখা করবেন", "F/U after 3 months", etc.
 * When `fillDate` is set and only inDays is known, date = baseYmd (the
 * prescription date, else today in the app tz) + inDays.
 */
export const normalizeFollowUp = (
  raw: any,
  fallbackText?: string | null,
  fillDate = false,
  baseYmd?: string | null
): IFollowUp | null => {
  let inDays: number | null = null;
  let date: string | null = null;
  let note: string | null = null;

  if (raw && typeof raw === "object") {
    inDays = toPositiveInt(raw.inDays) ?? null;
    date = isValidYmd(raw.date) ? raw.date : null;
    note = strOrNull(raw.note);
  }
  if (inDays === null && date === null && fallbackText) {
    inDays = parseFollowUpDays(fallbackText);
  }
  if (inDays === null && date === null && note === null) return null;
  if (fillDate && !date && inDays) date = addDaysYmd(baseYmd || ymdInAppTz(), inDays);
  return { inDays, date, note };
};

/** Normalise an AI parse result (structured fields coerced or derived) */
export const normalizeParsedPrescription = (data: any, sourceText?: string): ParsedPrescription => {
  const medicines = (data.medicines || [])
    .filter((med: any) => med && typeof med.name === "string" && med.name.trim().length > 0)
    .map((med: any) => normalizeMedicine(med, { fillEmptyDaily: true }));

  const notes = strOrNull(data.notes);
  const followUp = normalizeFollowUp(data.followUp, [notes, sourceText].filter(Boolean).join("\n"));

  return {
    ...data,
    prescriptionDate: normalizePrescriptionDate(data.prescriptionDate),
    vitals: normalizeVitals(data.vitals),
    allergies: cleanAllergies(data.allergies),
    symptoms: [...new Set((data.symptoms || []).filter(Boolean))] as string[],
    diagnosis: [...new Set((data.diagnosis || []).filter(Boolean))] as string[],
    medicines,
    notes,
    followUp,
  };
};
