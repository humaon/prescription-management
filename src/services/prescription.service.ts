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
