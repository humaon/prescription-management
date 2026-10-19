// src/jobs/reminderScheduler.ts
import {
  getDueRemindersService,
  getFollowUpsToNotifyService,
  getPendingTestRemindersService,
  getLowStockRemindersService,
} from "../services/prescription.service";
import { ReminderModel } from "../models/reminder.model";
import { PrescriptionModel } from "../models/prescription.model";
import {
  sendMedicationReminder,
  sendFollowUpReminder,
  sendPendingTestsReminder,
  sendRefillReminder,
  MedicationNotification,
} from "../services/notification.service";
import { getUserFCMTokens, deactivateFCMToken, cleanupInactiveTokens } from "../services/fcm.service";

/**
 * Send notification to user for medication reminder
 */
const sendNotification = async (
  userId: string,
  medicineName: string,
  dosage: string,
  timeSlot: "morning" | "noon" | "night",
  prescriptionId?: string
) => {
  try {
    console.log(`📲 Sending notification to user ${userId} for ${medicineName} (${dosage}) at ${timeSlot}`);
    const fcmTokens = await getUserFCMTokens(userId);
    console.log(`🔔 Found ${fcmTokens.length} FCM tokens for user ${userId}`, fcmTokens);
    
    if (fcmTokens.length === 0) {
      console.log(`⚠️ No active FCM tokens for user ${userId}`);
      return;
    }

    const notification: MedicationNotification = {
      userId,
      medicineName,
      dosage,
      timeSlot,
      prescriptionId,
    };

    let sentCount = 0;
    let failedCount = 0;

    for (const token of fcmTokens) {
      try {
        await sendMedicationReminder(token, notification);
        sentCount++;
      } catch (error: any) {
        failedCount++;
        if (error.message === "INVALID_TOKEN") {
          await deactivateFCMToken(token);
          console.log(`🗑️ Deactivated invalid token for user ${userId}`);
        }
      }
    }

    console.log(
      `[REMINDER] User ${userId}: ${medicineName} (${dosage}) - ${timeSlot}`,
      `| Sent: ${sentCount}, Failed: ${failedCount}`
    );
  } catch (error) {
    console.error(`❌ Error sending notification to user ${userId}:`, error);
  }
};

/**
 * Follow-up visit notifications, once each per visit date
 */
export const runFollowUpReminders = async (when: "tomorrow" | "today") => {
  const due = await getFollowUpsToNotifyService(when);
  const mark = when === "tomorrow" ? "followUp.notifiedAt" : "followUp.dayOfNotifiedAt";
  for (const p of due) {
    const userId = p.userId.toString();
    const tokens = await getUserFCMTokens(userId);
    for (const token of tokens) {
      try {
        await sendFollowUpReminder(token, {
          userId,
          prescriptionId: p._id,
          doctorName: p.doctor?.name ?? null,
          date: p.followUp!.date!,
          note: p.followUp?.note ?? null,
          when,
          pendingTests: (p.tests ?? []).filter((t: any) => t.status === "pending").map((t: any) => t.name),
          hasReports: (p.tests ?? []).some((t: any) => t.status === "completed"),
        });
      } catch (error: any) {
        if (error.message === "INVALID_TOKEN") await deactivateFCMToken(token);
        else console.error(`❌ Follow-up notification failed for user ${userId}:`, error);
      }
    }
    await PrescriptionModel.updateOne({ _id: p._id }, { [mark]: new Date() });
  }
  console.log(`📅 Follow-up (${when}) reminders processed: ${due.length}`);
  return due.length;
};

/**
 * "Tests still pending" nudges (day 3 and day 7 after the prescription)
 */
export const runPendingTestReminders = async () => {
  const due = await getPendingTestRemindersService();
  for (const { prescription: p, stage, days, tests } of due) {
    const userId = p.userId.toString();
    const tokens = await getUserFCMTokens(userId);
    for (const token of tokens) {
      try {
        await sendPendingTestsReminder(token, {
          userId,
          prescriptionId: p._id.toString(),
          testNames: tests.map((t: any) => t.name),
          doctorName: p.doctor?.name ?? null,
          days,
        });
      } catch (error: any) {
        if (error.message === "INVALID_TOKEN") await deactivateFCMToken(token);
        else console.error(`❌ Pending-test notification failed for user ${userId}:`, error);
      }
    }
    const ids = tests.map((t: any) => t._id);
    await PrescriptionModel.updateOne(
      { _id: p._id },
      { $set: { "tests.$[t].reminderStage": stage } },
      { arrayFilters: [{ "t._id": { $in: ids } }] }
    );
  }
  console.log(`🧪 Pending-test reminders processed: ${due.length}`);
  return due.length;
};

/**
 * "Running low" alerts for medicines whose stock is tracked
 */
export const runRefillReminders = async () => {
  const low = await getLowStockRemindersService();
  for (const { reminder: r, daysLeft } of low) {
    const userId = r.userId.toString();
    const tokens = await getUserFCMTokens(userId);
    for (const token of tokens) {
      try {
        await sendRefillReminder(token, {
          userId,
          reminderId: r._id.toString(),
          medicineName: r.medicineName,
          stockCount: r.stockCount ?? 0,
          daysLeft,
        });
      } catch (error: any) {
        if (error.message === "INVALID_TOKEN") await deactivateFCMToken(token);
        else console.error(`❌ Refill notification failed for user ${userId}:`, error);
      }
    }
    await ReminderModel.updateOne({ _id: r._id }, { refillAlertedAt: new Date() });
  }
  console.log(`💊 Refill reminders processed: ${low.length}`);
  return low.length;
};

/**
 * Run reminders for a specific time slot (exported for individual endpoints)
 */
export const runRemindersForTimeSlot = async (timeSlot: "morning" | "noon" | "night") => {
  console.log(`⏰ Starting ${timeSlot} reminder job at ${new Date().toISOString()}`);

  try {
    await runFollowUpReminders("tomorrow");
    // "Visit today" makes no sense at night
    if (timeSlot !== "night") await runFollowUpReminders("today");
  } catch (error) {
    console.error("❌ Follow-up reminder error:", error);
  }
  if (timeSlot === "morning") {
    try {
      await runPendingTestReminders();
    } catch (error) {
      console.error("❌ Pending-test reminder error:", error);
    }
    try {
      await runRefillReminders();
    } catch (error) {
      console.error("❌ Refill reminder error:", error);
    }
  }
  
  const reminders = await getDueRemindersService(timeSlot);
  console.log(`🔍 Retrieved ${reminders.length} due reminders for ${timeSlot}`);
  
  if (reminders.length === 0) {
    console.log(`📭 No ${timeSlot} reminders to send`);
    return 0;
  }

  console.log(`📬 Found ${reminders.length} ${timeSlot} reminders to process`);

  for (const reminder of reminders) {
    if (!reminder.userId) {
      console.warn(`⚠️ Reminder ${reminder._id} has no userId, skipping`);
      continue;
    }
    // The user's phone rings its own alarm for this dose
    const owner = reminder.userId as any;
    if (owner.localAlarms) continue;
    // A family member's medicine says whose it is
    const profileName = reminder.profileId
      ? owner.profiles?.find((p: any) => p._id.equals(reminder.profileId))?.name
      : null;

    await sendNotification(
      owner._id.toString(),
      profileName ? `${profileName}: ${reminder.medicineName}` : reminder.medicineName,
      reminder.dosage,
      timeSlot,
      reminder.prescriptionId?.toString()
    );
  
    // Update last notified timestamp
    await ReminderModel.findByIdAndUpdate(reminder._id, {
      lastNotifiedAt: new Date(),
    });
  }

  console.log(`✅ Processed ${reminders.length} ${timeSlot} reminders`);
  return reminders.length;
};

/**
 * Run all reminders (kept for backwards compatibility or manual triggers)
 */
export const runAllReminders = async () => {
  const morning = await runRemindersForTimeSlot("morning");
  const noon = await runRemindersForTimeSlot("noon");
  const night = await runRemindersForTimeSlot("night");

  console.log(`✅ Reminders sent: Morning(${morning}) Noon(${noon}) Night(${night})`);
  
  return { morning, noon, night };
};

/**
 * Cleanup jobs
 */
export const runCleanupJobs = async () => {
  console.log(`🧹 Starting cleanup job at ${new Date().toISOString()}`);
  
  // Expired reminders
  const now = new Date();
  const expired = await ReminderModel.updateMany(
    { isActive: true, endDate: { $ne: null, $lt: now } },
    { isActive: false }
  );
  console.log(`🧹 Deactivated ${expired.modifiedCount} expired reminders`);

  // Invalid FCM tokens
  await cleanupInactiveTokens();
  console.log("🧹 FCM token cleanup done");
  
  return { expiredReminders: expired.modifiedCount };
};