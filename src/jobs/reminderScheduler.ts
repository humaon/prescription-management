// src/jobs/reminderScheduler.ts
import { getDueRemindersService } from "../services/prescription.service";
import { ReminderModel } from "../models/reminder.model";
import { sendMedicationReminder, MedicationNotification } from "../services/notification.service";
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
 * Run reminders for a specific time slot (exported for individual endpoints)
 */
export const runRemindersForTimeSlot = async (timeSlot: "morning" | "noon" | "night") => {
  console.log(`⏰ Starting ${timeSlot} reminder job at ${new Date().toISOString()}`);
  
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
  
    await sendNotification(
      reminder?.userId?._id.toString(),
      reminder.medicineName,
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