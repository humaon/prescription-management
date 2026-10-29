import { Types } from "mongoose";
import { CareLinkModel } from "../models/careLink.model";
import { MedicineTakenLogModel } from "../models/medicineTakenLog.model";
import { ReminderModel } from "../models/reminder.model";
import { User } from "../models/user.model";
import { getAdherenceService } from "./features.service";
import { getUserFCMTokens, deactivateFCMToken } from "./fcm.service";
import { sendMedicationReminder } from "./notification.service";

type Slot = "morning" | "noon" | "night";
const SLOT_BN = { morning: "সকালের", noon: "দুপুরের", night: "রাতের" };

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export const inviteCaregiverService = async (patientId: string, caregiverEmail: string) => {
  const caregiver = await User.findOne({ email: caregiverEmail.toLowerCase().trim() });
  if (!caregiver) throw new Error("No MediCare account found with this email. Ask them to sign up first.");
  if (caregiver.id === patientId) throw new Error("You cannot add yourself as a caregiver");

  const existing = await CareLinkModel.findOne({
    patientId: new Types.ObjectId(patientId),
    caregiverId: caregiver._id,
  });
  if (existing) throw new Error("This person is already invited");

  return CareLinkModel.create({
    patientId: new Types.ObjectId(patientId),
    caregiverId: caregiver._id,
    status: "pending",
  });
};

export const listCareLinksService = async (userId: string) => {
  const uid = new Types.ObjectId(userId);
  const [myCaregivers, carePatients] = await Promise.all([
    CareLinkModel.find({ patientId: uid }).populate("caregiverId", "fullName email"),
    CareLinkModel.find({ caregiverId: uid }).populate("patientId", "fullName email"),
  ]);
  return { myCaregivers, carePatients };
};

export const acceptCareLinkService = async (userId: string, linkId: string) => {
  const link = await CareLinkModel.findOneAndUpdate(
    { _id: new Types.ObjectId(linkId), caregiverId: new Types.ObjectId(userId) },
    { status: "active" },
    { new: true }
  );
  if (!link) throw new Error("Invitation not found");
  return link;
};

export const removeCareLinkService = async (userId: string, linkId: string) => {
  const uid = new Types.ObjectId(userId);
  return CareLinkModel.findOneAndDelete({
    _id: new Types.ObjectId(linkId),
    $or: [{ patientId: uid }, { caregiverId: uid }],
  });
};

export const getPatientTodayService = async (caregiverId: string, patientId: string) => {
  const link = await CareLinkModel.findOne({
    caregiverId: new Types.ObjectId(caregiverId),
    patientId: new Types.ObjectId(patientId),
    status: "active",
  });
  if (!link) throw new Error("You are not an active caregiver for this person");

  const today = startOfToday();
  const [patient, logs, adherence] = await Promise.all([
    User.findById(patientId).select("fullName"),
    MedicineTakenLogModel.find({ userId: new Types.ObjectId(patientId), scheduledDate: today }),
    getAdherenceService(patientId, 7),
  ]);

  return {
    patient: { id: patientId, name: patient?.fullName },
    today: logs.map((l) => ({
      medicineName: l.medicineName,
      dosage: l.dosage,
      timeSlot: l.timeSlot,
      status: l.status,
      takenAt: l.takenAt,
    })),
    last7DaysAdherence: adherence,
  };
};

// Called by cron-job.org ~45 min after each slot's reminder cron.
export const runMissedDoseCheck = async (slot: Slot, onlyUserId?: string) => {
  const today = startOfToday();

  const reminders = await ReminderModel.find({
    ...(onlyUserId && Types.ObjectId.isValid(onlyUserId)
      ? { userId: new Types.ObjectId(onlyUserId) }
      : {}),
    isActive: true,
    [`schedules.${slot}`]: true,
    startDate: { $lte: today },
    $or: [{ endDate: null }, { endDate: { $gte: today } }],
  });

  const missedByPatient = new Map<string, string[]>();

  for (const r of reminders) {
    const existing = await MedicineTakenLogModel.findOne({
      userId: r.userId,
      reminderId: r._id,
      scheduledDate: today,
      timeSlot: slot,
    });
    if (existing) continue;

    try {
      await MedicineTakenLogModel.create({
        userId: r.userId,
        reminderId: r._id,
        prescriptionId: r.prescriptionId,
        medicineName: r.medicineName,
        dosage: r.dosage,
        timeSlot: slot,
        scheduledDate: today,
        status: "missed",
      });
    } catch (e: any) {
      if (e.code === 11000) continue; // patient logged it concurrently
      throw e;
    }

    const key = r.userId.toString();
    missedByPatient.set(key, [...(missedByPatient.get(key) || []), r.medicineName]);
  }

  let alertsSent = 0;
  for (const [patientId, meds] of missedByPatient) {
    const links = await CareLinkModel.find({
      patientId: new Types.ObjectId(patientId),
      status: "active",
    });
    if (links.length === 0) continue;

    const patient = await User.findById(patientId).select("fullName");

    for (const link of links) {
      const caregiver = await User.findById(link.caregiverId).select("language");
      const isBn = caregiver?.language !== "en";
      const name = patient?.fullName || "Your family member";
      const list = meds.join(", ");

      const tokens = await getUserFCMTokens(link.caregiverId.toString());
      for (const token of tokens) {
        try {
          await sendMedicationReminder(
            token,
            {
              userId: link.caregiverId,
              medicineName: list,
              dosage: "",
              timeSlot: slot,
              language: isBn ? "bn" : "en",
            },
            {
              type: "missed_dose_alert",
              title: isBn ? `⚠️ ${name} ওষুধ খাননি` : `⚠️ ${name} missed a dose`,
              body: isBn ? `${SLOT_BN[slot]} ওষুধ: ${list}` : `${slot} medicine: ${list}`,
              extra: { patientId },
            }
          );
          alertsSent++;
        } catch (err: any) {
          if (err.message === "INVALID_TOKEN") await deactivateFCMToken(token);
        }
      }
    }

    await MedicineTakenLogModel.updateMany(
      { userId: new Types.ObjectId(patientId), scheduledDate: today, timeSlot: slot, status: "missed" },
      { caregiverNotified: true }
    );
  }

  return { slot, missedPatients: missedByPatient.size, alertsSent };
};
