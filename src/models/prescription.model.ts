import mongoose, { Schema, Document, Types } from "mongoose";

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
  name: string;
  type?: string | null;
  status: "pending",              // NEW: pending | completed | cancelled
  completedDate: null,             // NEW: When test was done
  reportUrl: null,                 // NEW: S3 URL for report
  resultSummary: null,             // NEW: "Blood sugar: 95 mg/dL"
  notes: null         
}

export interface IMedicine {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}

export interface IPrescriptionDocument extends Document {
  userId: Types.ObjectId;
  doctor: IDoctorInfo;
  patient: IPatientInfo;
  symptoms: string[];
  diagnosis: string[];
  tests: ITest[];
  medicines: IMedicine[];
  notes?: string | null;
  ocrText: string;
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
    resultSummary: { type: String, default: null },
    notes: { type: String, default: null },
  }, { _id: true }); 


// Medicine Sub-Schema
const MedicineSchema = new Schema<IMedicine>(
  {
    name: { type: String, required: true, index: true },
    dosage: { type: String, default: null },
    frequency: { type: String, default: null },
    duration: { type: String, default: null },
    instructions: { type: String, default: null },
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

    // Doctor Information
    doctor: { type: DoctorInfoSchema, required: true },

    // Patient Information
    patient: { type: PatientInfoSchema, required: true },

    // Clinical Data
    symptoms: { type: [String], default: [] },
    diagnosis: { type: [String], default: [] },

    // Tests
    tests: { type: [TestSchema], default: [] },

    // Medicines
    medicines: { type: [MedicineSchema], default: [] },

    // Additional Notes
    notes: { type: String, default: null },

    // OCR Data
    ocrText: { type: String, required: true },

    // Current Status
    isCurrent: {
      type: Boolean,
      default: true,
      index: true,
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