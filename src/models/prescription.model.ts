import mongoose, { Schema, Document } from "mongoose";

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
}

export interface IMedicine {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}

export interface IPrescriptionDocument extends Document {
  doctor: IDoctorInfo;
  patient: IPatientInfo;
  symptoms: string[];
  diagnosis: string[];
  tests: ITest[];
  medicines: IMedicine[];
  notes?: string | null;
  ocrText: string;
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
    type: { type: String, default: null },
  },
  { _id: false }
);

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
