import { Types } from "mongoose";
import { appConfig } from "../config/app.config";
import { getPrompt } from "../lib/prompt";
import {
  IPrescriptionDocument,
  PrescriptionModel,
} from "../models/prescription.model";
import {
  ParsedPrescription,
  validatePrescriptionParsedData,
} from "../validation/prescription.validation";
import { ReminderModel } from "../models/reminder.model";
import { parseDosageSchedule } from "../lib/dosageParser";
import { PrescriptionFeedbackModel } from "../models/PrescriptionFeedback.model";
import PDFDocument from 'pdfkit';


// Parse prescription text using Gemini API

const normalizeBanglaDosage = (dosage: string): string => {
  if (!dosage || typeof dosage !== "string") {
    return dosage;
  }

  const banglaToEnglish: { [key: string]: string } = {
    '০': '0',
    '১': '1',
  };

  let result = dosage;
  Object.entries(banglaToEnglish).forEach(([bangla, english]) => {
    result = result.replace(new RegExp(bangla, 'g'), english);
  });

  return result;
};

// Parse prescription text using Gemini API
export const prescriptionParseService = async (
  text: string
): Promise<ParsedPrescription> => {
  if (!text || text.trim().length === 0) {
    throw new Error("Prescription text is empty");
  }

  const prompt = getPrompt(text);
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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
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

    if (parsedData.medicines.length > 0) {
      parsedData.medicines = parsedData.medicines
        .filter((med: any) => med.name && med.name.trim().length > 0)
        .map((med: any) => ({
          ...med,
          // Normalize Bangla digits to English in dosage
          dosage: med.dosage ? normalizeBanglaDosage(med.dosage) : med.dosage,
        }));
    }

    parsedData.symptoms = [...new Set(parsedData.symptoms.filter(Boolean))];
    parsedData.diagnosis = [...new Set(parsedData.diagnosis.filter(Boolean))];

    return parsedData as ParsedPrescription;
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
//   const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${appConfig.GEMINI_API_KEY}`;

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

// Helper: Calculate end date from duration string
const calculateEndDate = (duration: string): Date | null => {
  const daysMatch = duration.match(/(\d+)\s*days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    return endDate;
  }

  const weeksMatch = duration.match(/(\d+)\s*weeks?/i);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + weeks * 7);
    return endDate;
  }

  const monthsMatch = duration.match(/(\d+)\s*months?/i);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1]);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);
    return endDate;
  }

  return null;
};

// Helper: Create reminders for medicines
const createRemindersForMedicines = async (
  prescriptionId: string,
  userId: string,
  medicines: any[]
) => {
  const reminders = [];

  for (const medicine of medicines) {
    if (!medicine.dosage) continue;

    const schedule = parseDosageSchedule(medicine.frequency || medicine.dosage);

    if (schedule.totalDoses > 0) {
      const reminder = new ReminderModel({
        userId: new Types.ObjectId(userId),
        prescriptionId: new Types.ObjectId(prescriptionId),
        medicineName: medicine.name,
        dosage: medicine.dosage,
        schedules: {
          morning: schedule.morning,
          noon: schedule.noon,
          night: schedule.night,
        },
        isActive: true,
        startDate: new Date(),
        endDate: medicine.duration ? calculateEndDate(medicine.duration) : null,
      });

      reminders.push(await reminder.save());
    }
  }

  return reminders;
};

// Save prescription with user-edited data and auto-create reminders
export const prescriptionSaveService = async (
  prescriptionData: any,
  userId: string
) => {

  if (prescriptionData.tests && Array.isArray(prescriptionData.tests)) {
    prescriptionData.tests = prescriptionData.tests.map((test: any) => ({
      name: test.name,
      type: test.type || null,
      status: "pending",           // ⭐ HERE - Always set to pending for new tests
      completedDate: null,
      reportUrl: null,
      resultSummary: null,
      notes: null,
    }));
  }
  // Create new prescription with user-edited data
  const prescription = new PrescriptionModel({
    ...prescriptionData,
    userId: new Types.ObjectId(userId),
    status: "confirmed",
    processingStatus: "completed",
    parsedAt: new Date(),
    uploadedAt: new Date(),
    isCurrent: prescriptionData.isCurrent ?? true,
    isComplete: false,
  });

  const savedPrescription = await prescription.save();

  // Auto-create reminders if prescription is current
  if (savedPrescription.isCurrent && savedPrescription.medicines.length > 0) {
    try {
      await createRemindersForMedicines(
        savedPrescription._id.toString(),
        userId,
        savedPrescription.medicines
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
  updateData: any
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  });

  if (!prescription) {
    throw new Error("Prescription not found or access denied");
  }

  // Update fields
  Object.assign(prescription, updateData);
  prescription.parsedAt = new Date();

  const updatedPrescription = await prescription.save();

  // If prescription is current, recreate reminders with updated data
  if (updatedPrescription.isCurrent && updatedPrescription.medicines.length > 0) {
    try {
      // Delete old reminders
      await ReminderModel.deleteMany({
        prescriptionId: new Types.ObjectId(prescriptionId),
      });

      // Create new reminders with updated medicine data
      await createRemindersForMedicines(
        prescriptionId,
        userId,
        updatedPrescription.medicines
      );
    } catch (error) {
      console.error("Failed to update reminders:", error);
    }
  }

  return updatedPrescription;
};

// Get all prescriptions for a user
export const prescriptionGetAllService = async (userId: string) => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
  })
    .sort({ uploadedAt: -1 })
    .lean();

  return prescriptions;
};

// Get only current prescriptions
export const prescriptionGetCurrentService = async (userId: string) => {
  const prescriptions = await PrescriptionModel.find({
    userId: new Types.ObjectId(userId),
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
  // Delete associated reminders first
  await ReminderModel.deleteMany({
    prescriptionId: new Types.ObjectId(prescriptionId),
  });

  const deletedPrescription = await PrescriptionModel.findOneAndDelete({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  });

  if (!deletedPrescription) {
    throw new Error("Prescription not found or access denied");
  }

  return deletedPrescription;
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
    throw new Error("Prescription not found or access denied");
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
export const getUserRemindersService = async (userId: string) => {
  return await ReminderModel.find({
    userId: new Types.ObjectId(userId),
    isActive: true,
  })
    .populate("prescriptionId", "doctor patient uploadedAt")
    .sort({ createdAt: -1 })
    .lean();
};

// Get due reminders for notification scheduler
export const getDueRemindersService = async (
  timeSlot: "morning" | "noon" | "night"
) => {
  const now = new Date();

  return await ReminderModel.find({
    isActive: true,
    [`schedules.${timeSlot}`]: true,
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
    startDate: { $lte: now },
  })
    .populate("userId", "email name")
    .lean();
};

// Get prescription statistics
export const getPrescriptionStatsService = async (userId: string) => {
  const stats = await PrescriptionModel.aggregate([
    {
      $match: { userId: new Types.ObjectId(userId) },
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
    reportUrl?: string;
    resultSummary?: string;
    notes?: string;
  }
) => {
  const prescription = await PrescriptionModel.findOne({
    _id: new Types.ObjectId(prescriptionId),
    userId: new Types.ObjectId(userId),
  });

  if (!prescription) {
    throw new Error("Prescription not found or access denied");
  }

  // Find test by _id in the array
  const testIndex = prescription.tests.findIndex(
    (t) => t._id?.toString() === testId
  );

  if (testIndex === -1) {
    throw new Error("Test not found in this prescription");
  }

  // Update test properties
  prescription.tests[testIndex].status = "completed";
  prescription.tests[testIndex].completedDate = new Date();
  prescription.tests[testIndex].reportUrl = data.reportUrl || null;
  prescription.tests[testIndex].resultSummary = data.resultSummary || null;
  prescription.tests[testIndex].notes = data.notes || null;

  await prescription.save();

  return {
    prescriptionId: prescription._id,
    test: prescription.tests[testIndex],
  };
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
    throw new Error("Prescription not found or access denied");
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
        reportUrl: test.reportUrl,
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

  // if (!prescription) {
  //   throw new Error("Prescription not found or access denied");
  // }

  // const test = prescription.tests.id(testId);

  // if (!test) {
  //   throw new Error("Test not found in this prescription");
  // }

  // test.status = "cancelled";
  // test.notes = reason || "Cancelled by user";

  // await prescription.save();

  // return {
  //   prescriptionId: prescription._id,
  //   test: test.toObject(),
  // };
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
    throw new Error("Prescription not found or access denied");
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
    status: "confirmed",
  })
    .sort({ uploadedAt: 1 })
    .lean();

  if (prescriptions.length === 0) {
    throw new Error("No prescriptions found for this user");
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
          completedTests.push({
            name: test.name,
            type: test.type,
            completedDate: test.completedDate,
            resultSummary: test.resultSummary,
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
      testName: results[0]?.notes || testType,
      results: results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
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
  
  return {
    generatedAt: new Date(),
    patientInfo,
    treatmentPeriod,
    clinicalTimeline,
    testResultsSummary,
    healthProgressionSummary,
    medicationAnalysis,
    clinicalObservations,
  };
};
export const generateClinicalSummaryPDFService = async (
  userId: string
): Promise<Buffer> => {
  // Get the AI narrative
  const narrative = await generateAIClinicalNarrativeService(userId);
  
  // Get basic patient info
  const summary = await getDetailedClinicalSummaryService(userId);

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

      // Header
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('Clinical Summary Report', { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
        .moveDown(0.5);

      // Horizontal line
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1);

      // Patient Info
      doc.fontSize(12).font('Helvetica-Bold').text('Patient Information').moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Name: ${summary.patientInfo.name}`);
      doc.text(`Age: ${summary.patientInfo.age} years`);
      doc.text(`Gender: ${summary.patientInfo.gender === 'M' ? 'Male' : 'Female'}`);
      doc.text(`Contact: ${summary.patientInfo.contact}`);
      doc.moveDown(1);

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

      doc
        .fontSize(11)
        .font('Helvetica')
        .text(narrative, {
          align: 'justify',
          lineGap: 5,
        });

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
export const generateAIClinicalNarrativeService = async (
  userId: string
): Promise<string> => {
  // Get the detailed summary data
  const summaryData = await getDetailedClinicalSummaryService(userId);

  // Create a prompt for Gemini to generate narrative clinical notes
  const prompt = `
You are a medical professional writing detailed clinical notes. Based on the following patient data, write a comprehensive clinical summary in a professional medical narrative format.

**Patient Information:**
- Name: ${summaryData.patientInfo.name}
- Age: ${summaryData.patientInfo.age}
- Gender: ${summaryData.patientInfo.gender}

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

---

Please write a detailed, professional clinical narrative summary (500-800 words) that:
1. Provides a chronological overview of the patient's treatment journey
2. Highlights key symptoms, diagnoses, and treatment approaches
3. Discusses medication effectiveness and any side effects
4. Analyzes test results and their clinical significance
5. Evaluates overall health progression and patient response to treatment
6. Provides clinical insights and potential recommendations for ongoing care

Write in a professional medical tone suitable for clinical documentation. Use proper medical terminology and maintain HIPAA-compliant language.
`;

  // Call Gemini API
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
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();

    if (!data.candidates || !data.candidates[0]) {
      throw new Error("Invalid response from Gemini API");
    }

    const narrativeText = data.candidates[0].content.parts[0].text;

    return narrativeText;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Clinical narrative generation failed: ${error.message}`);
    }
    throw new Error("Clinical narrative generation failed: Unknown error");
  }
};
