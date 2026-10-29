import mongoose, { Schema, Document, Types } from "mongoose";
import { IVitals } from "../lib/vitals";
import { LabResult } from "../lib/reportReader";

export interface IDoctorInfo {
  name: string | null;
  specialization: string | null;
  licenseNumber: string | null;
  contact: string | null;
}

export interface IPatientInfo {
  name: string | null;
  age: string | null;
  gender: "M" | "F" | null;
  contact: string | null;
  registrationNumber: string | null;
}

export interface ITest {
  _id?: any;  // Mongoose adds this automatically
  name: string;
  type?: string | null;
  status: "pending" | "completed" | "cancelled";  // Union type, not just "pending"
  completedDate?: Date | null;     // Can be Date or null
  reportUrl?: string | null;       // storage key (see lib/reportStorage), never public
  reportMimeType?: string | null;
  // Read from the report by AI (values as printed; flag computed in lib/reportReader)
  results?: LabResult[];
  aiSummary?: string | null;
  // "Still pending" reminders sent so far (1 = day 3, 2 = day 7)
  reminderStage?: number;
  resultSummary?: string | null;   // Can be string or null
  notes?: string | null;           // Can be string or null
}

export type MedicineForm =
  | "tablet" | "capsule" | "syrup" | "drops" | "inhaler"
  | "injection" | "insulin" | "topical" | "other";
export type MedicineScheduleType = "daily" | "weekly" | "as_needed" | "once";
export type MealTiming = "before_meal" | "after_meal" | "with_meal" | "empty_stomach";

export const MEDICINE_FORMS: MedicineForm[] = [
  "tablet", "capsule", "syrup", "drops", "inhaler", "injection", "insulin", "topical", "other",
];
export const SCHEDULE_TYPES: MedicineScheduleType[] = ["daily", "weekly", "as_needed", "once"];
export const MEAL_TIMINGS: MealTiming[] = ["before_meal", "after_meal", "with_meal", "empty_stomach"];

export interface IMedicine {
  name: string;
  genericName?: string | null; // English active ingredient(s), from AI when confident
  // Free text, kept in the original language/script as written
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
  // Structured fields (absent on prescriptions saved before they existed —
  // those are derived from the free text when reminders are (re)created)
  form?: MedicineForm | null;
  schedule?: { morning: boolean; noon: boolean; night: boolean };
  scheduleType?: MedicineScheduleType;
  weekDays?: number[]; // 0=Sun..6=Sat, weekly only
  durationDays?: number | null;
  continueIndefinitely?: boolean;
  mealTiming?: MealTiming | null;
}

export interface IFollowUp {
  inDays: number | null;
  date: string | null; // YYYY-MM-DD
  note: string | null;
  notifiedAt?: Date | null; // "visit tomorrow" sent
  dayOfNotifiedAt?: Date | null; // "visit today" sent
}

export interface IPrescriptionDocument extends Document {
  userId: Types.ObjectId;
<<<<<<< HEAD
  familyMemberId?: Types.ObjectId | null;
=======
  profileId?: Types.ObjectId | null; // family member; null = the account holder
>>>>>>> 64974c0da637dfad3a29f38640fbf82eabd20ed1
  doctor: IDoctorInfo;
  patient: IPatientInfo;
  symptoms: string[];
  diagnosis: string[];
  allergies?: string[];
  tests: ITest[];
  medicines: IMedicine[];
  notes?: string | null;
  followUp?: IFollowUp | null;
  prescriptionDate?: string | null; // YYYY-MM-DD, the day the doctor wrote it
  vitals?: IVitals | null;
  ocrText: string;
  imageUrl?: string | null;
  isCurrent: boolean;
  isComplete: boolean;
  completedAt?: Date | null;
  status: "draft" | "confirmed"; // ADDED for draft/confirmed workflow
  processingStatus: "pending" | "processing" | "completed" | "failed";
  errorMessage?: string | null;
  uploadedAt: Date;
  parsedAt?: Date | null;
  processingTime: number; // milliseconds
  createdAt: Date;
  updatedAt: Date;
}

// Doctor Info Sub-Schema
const DoctorInfoSchema = new Schema<IDoctorInfo>(
  {
    name: { type: String, default: null },
    specialization: { type: String, default: null },
    licenseNumber: { type: String, default: null },
    contact: { type: String, default: null },
  },
  { _id: false }
);

// Patient Info Sub-Schema
const PatientInfoSchema = new Schema<IPatientInfo>(
  {
    name: { type: String, default: null, index: true },
    age: { type: String, default: null },
    gender: {
      type: String,
      enum: ["M", "F", null],
      default: null,
    },
    contact: { type: String, default: null },
    registrationNumber: { type: String, default: null, index: true },
  },
  { _id: false }
);

// Test Sub-Schema
const TestSchema = new Schema<ITest>(
  {
    name: { type: String, required: true },
    type: { type: String, default: null },status: { type: String, enum: ["pending", "completed", "cancelled"], default: "pending" },
    completedDate: { type: Date, default: null },
    reportUrl: { type: String, default: null },
    reportMimeType: { type: String, default: null },
    results: {
      type: [
        new Schema(
          {
            name: { type: String, required: true },
            value: { type: String, required: true },
            unit: { type: String, default: null },
            referenceRange: { type: String, default: null },
            flag: { type: String, enum: ["high", "low", "normal", null], default: null },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    aiSummary: { type: String, default: null },
    reminderStage: { type: Number, default: 0 },
    resultSummary: { type: String, default: null },
    notes: { type: String, default: null },
  }, { _id: true }); 


// Medicine Sub-Schema
const MedicineSchema = new Schema<IMedicine>(
  {
    name: { type: String, required: true, index: true },
    genericName: { type: String, default: null },
    dosage: { type: String, default: null },
    frequency: { type: String, default: null },
    duration: { type: String, default: null },
    instructions: { type: String, default: null },
    // No defaults on the structured fields: "absent" means "derive from text"
    form: { type: String, enum: [...MEDICINE_FORMS, null], default: undefined },
    schedule: {
      type: new Schema(
        {
          morning: { type: Boolean, default: false },
          noon: { type: Boolean, default: false },
          night: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: undefined,
    },
    scheduleType: { type: String, enum: SCHEDULE_TYPES, default: undefined },
    weekDays: { type: [Number], default: undefined },
    durationDays: { type: Number, default: undefined },
    continueIndefinitely: { type: Boolean, default: undefined },
    mealTiming: { type: String, enum: [...MEAL_TIMINGS, null], default: undefined },
  },
  { _id: false }
);

const FollowUpSchema = new Schema<IFollowUp>(
  {
    inDays: { type: Number, default: null },
    date: { type: String, default: null }, // YYYY-MM-DD (app timezone)
    note: { type: String, default: null },
    notifiedAt: { type: Date, default: null },
    dayOfNotifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

// Main Prescription Schema
const PrescriptionSchema = new Schema<IPrescriptionDocument>(
  {
    // User Reference
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
<<<<<<< HEAD
    familyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "FamilyMember",
      default: null,
      index: true,
    },
=======
    profileId: { type: Schema.Types.ObjectId, default: null, index: true },
>>>>>>> 64974c0da637dfad3a29f38640fbf82eabd20ed1

    // Doctor Information
    doctor: { type: DoctorInfoSchema, required: true },

    // Patient Information
    patient: { type: PatientInfoSchema, required: true },

    // Clinical Data
    symptoms: { type: [String], default: [] },
    diagnosis: { type: [String], default: [] },
    allergies: { type: [String], default: [] },

    // Tests
    tests: { type: [TestSchema], default: [] },

    // Medicines
    medicines: { type: [MedicineSchema], default: [] },

    // Additional Notes
    notes: { type: String, default: null },

    // Follow-up visit ("৭ দিন পর আবার দেখা করবেন", "F/U after 3 months")
    followUp: { type: FollowUpSchema, default: null },

    // Day the prescription was written (YYYY-MM-DD); reminders and follow-up
    // are counted from it. null on old prescriptions → upload day.
    prescriptionDate: { type: String, default: null },

    // O/E findings as written + numbers parsed from them (lib/vitals)
    vitals: {
      type: new Schema(
        {
          bp: { type: String, default: null },
          pulse: { type: String, default: null },
          temperature: { type: String, default: null },
          weight: { type: String, default: null },
          spo2: { type: String, default: null },
          bloodSugar: { type: String, default: null },
          values: {
            systolic: { type: Number, default: null },
            diastolic: { type: Number, default: null },
            pulseBpm: { type: Number, default: null },
            temperatureF: { type: Number, default: null },
            weightKg: { type: Number, default: null },
            spo2Pct: { type: Number, default: null },
            bloodSugarMmol: { type: Number, default: null },
          },
        },
        { _id: false }
      ),
      default: null,
    },

    // OCR Data
    ocrText: { type: String, required: true },
    imageUrl: { type: String, default: null },

    // Current Status
    isCurrent: {
      type: Boolean,
      default: true,
      index: true,
    },
    isComplete: {
      type: Boolean,
      default: false,
      index: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    // Draft/Confirmed Status - ADDED
    status: {
      type: String,
      enum: ["draft", "confirmed"],
      default: "draft",
      index: true,
    },

    // Processing Status
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    errorMessage: { type: String, default: null },

    // Timestamps
    uploadedAt: { type: Date, default: Date.now, index: true },
    parsedAt: { type: Date, default: null },
    processingTime: { type: Number, default: 0 }, // milliseconds
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Compound index for user + status + upload date - ADDED
PrescriptionSchema.index({
  userId: 1,
  status: 1,
  uploadedAt: -1,
});

// Compound index for user + current status queries
PrescriptionSchema.index({
  userId: 1,
  isCurrent: 1,
  uploadedAt: -1,
});

// Compound index for user + processing status
PrescriptionSchema.index({
  userId: 1,
  processingStatus: 1,
});

// Upcoming follow-ups per user
PrescriptionSchema.index({ userId: 1, "followUp.date": 1 });

// Add text index for full-text search
PrescriptionSchema.index({
  "patient.name": "text",
  "doctor.name": "text",
  symptoms: "text",
  diagnosis: "text",
  ocrText: "text",
});

// Create Model
export const PrescriptionModel = mongoose.model<IPrescriptionDocument>(
  "Prescription",
  PrescriptionSchema
);