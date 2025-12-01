import {
  IDoctorInfo,
  IMedicine,
  IPatientInfo,
  ITest,
} from "../models/prescription.model";

export interface ParsedPrescription {
  doctor: IDoctorInfo;
  patient: IPatientInfo;
  symptoms: string[];
  diagnosis: string[];
  tests: ITest[];
  medicines: IMedicine[];
  notes: string | null;
}

export const validatePrescriptionParsedData = (
  data: any
): data is ParsedPrescription => {
  const requiredFields = [
    "doctor",
    "patient",
    "symptoms",
    "diagnosis",
    "tests",
    "medicines",
    "notes",
  ];

  if (!requiredFields.every((field) => field in data)) {
    return false;
  }

  if (!Array.isArray(data.symptoms) || !Array.isArray(data.diagnosis)) {
    return false;
  }

  if (!Array.isArray(data.medicines) || !Array.isArray(data.tests)) {
    return false;
  }

  if (!data.medicines.every((med: any) => typeof med.name === "string")) {
    return false;
  }

  return true;
};
