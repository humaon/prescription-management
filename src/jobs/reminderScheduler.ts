// src/jobs/reminderScheduler.ts (SIMPLIFIED VERSION)
import cron from "node-cron";
import { getDueRemindersService } from "../services/prescription.service";
import { ReminderModel } from "../models/reminder.model";
import {
  sendMedicationReminder,
  MedicationNotification,
} from "../services/notification.service";
import { getUserFCMTokens, deactivateFCMToken } from "../services/fcm.service";

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
    // Get all active FCM tokens for the user
    const fcmTokens = await getUserFCMTokens(userId);

    if (fcmTokens.length === 0) {
      console.log(`⚠️  No active FCM tokens for user ${userId}`);
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

    // Send to all user devices
    for (const token of fcmTokens) {
      try {
        await sendMedicationReminder(token, notification);
        sentCount++;
      } catch (error: any) {
        failedCount++;
        
        // If token is invalid, deactivate it
        if (error.message === "INVALID_TOKEN") {
          await deactivateFCMToken(token);
          console.log(`🗑️  Deactivated invalid token for user ${userId}`);
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
 * Morning reminders - 8:00 AM (Fixed for everyone)
 */
const scheduleMorningReminders = () => {
  cron.schedule("0 8 * * *", async () => {
    console.log("🌅 Running morning medication reminders at 8:00 AM...");

    try {
      const reminders = await getDueRemindersService("morning");

      if (reminders.length === 0) {
        console.log("No morning reminders to send");
        return;
      }

      for (const reminder of reminders) {
        await sendNotification(
          reminder.userId.toString(),
          reminder.medicineName,
          reminder.dosage,
          "morning",
          reminder.prescriptionId?.toString()
        );

        // Update last notified timestamp
        await ReminderModel.findByIdAndUpdate(reminder._id, {
          lastNotifiedAt: new Date(),
        });
      }

      console.log(`✅ Sent ${reminders.length} morning reminders`);
    } catch (error) {
      console.error("❌ Error sending morning reminders:", error);
    }
  });
};

/**
 * Noon reminders - 1:00 PM (Fixed for everyone)
 */
const scheduleNoonReminders = () => {
  cron.schedule("0 13 * * *", async () => {
    console.log("☀️  Running noon medication reminders at 1:00 PM...");

    try {
      const reminders = await getDueRemindersService("noon");

      if (reminders.length === 0) {
        console.log("No noon reminders to send");
        return;
      }

      for (const reminder of reminders) {
        await sendNotification(
          reminder.userId.toString(),
          reminder.medicineName,
          reminder.dosage,
          "noon",
          reminder.prescriptionId?.toString()
        );

        await ReminderModel.findByIdAndUpdate(reminder._id, {
          lastNotifiedAt: new Date(),
        });
      }

      console.log(`✅ Sent ${reminders.length} noon reminders`);
    } catch (error) {
      console.error("❌ Error sending noon reminders:", error);
    }
  });
};

/**
 * Night reminders - 8:00 PM (Fixed for everyone)
 */
const scheduleNightReminders = () => {
  cron.schedule("0 20 * * *", async () => {
    console.log("🌙 Running night medication reminders at 8:00 PM...");

    try {
      const reminders = await getDueRemindersService("night");

      if (reminders.length === 0) {
        console.log("No night reminders to send");
        return;
      }

      for (const reminder of reminders) {
        await sendNotification(
          reminder.userId.toString(),
          reminder.medicineName,
          reminder.dosage,
          "night",
          reminder.prescriptionId?.toString()
        );

        await ReminderModel.findByIdAndUpdate(reminder._id, {
          lastNotifiedAt: new Date(),
        });
      }

      console.log(`✅ Sent ${reminders.length} night reminders`);
    } catch (error) {
      console.error("❌ Error sending night reminders:", error);
    }
  });
};

/**
 * Clean up expired reminders - Runs daily at midnight
 */
const scheduleReminderCleanup = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("🧹 Running reminder cleanup...");
    
    try {
      const now = new Date();
      
      // Deactivate reminders that have passed their end date
      const result = await ReminderModel.updateMany(
        {
          isActive: true,
          endDate: { $ne: null, $lt: now },
        },
        {
          isActive: false,
        }
      );

      console.log(`✅ Deactivated ${result.modifiedCount} expired reminders`);
    } catch (error) {
      console.error("❌ Error during reminder cleanup:", error);
    }
  });
};

/**
 * Clean up invalid FCM tokens - Runs daily at midnight
 */
const scheduleTokenCleanup = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("🧹 Running FCM token cleanup...");
    
    try {
      const { cleanupInactiveTokens } = await import("../services/fcm.service");
      await cleanupInactiveTokens();
    } catch (error) {
      console.error("❌ Error during token cleanup:", error);
    }
  });
};

/**
 * Initialize all reminder schedulers
 */
export const initializeReminderSchedulers = () => {
  // Schedule medication reminders at fixed times
  scheduleMorningReminders();  // 8:00 AM
  scheduleNoonReminders();      // 1:00 PM
  scheduleNightReminders();     // 8:00 PM
  
  // Schedule daily cleanups
  scheduleReminderCleanup();    // Midnight
  scheduleTokenCleanup();       // Midnight
  
  console.log("✅ Medication reminder schedulers initialized");
  console.log("   🌅 Morning reminders: 8:00 AM (everyone)");
  console.log("   ☀️  Noon reminders: 1:00 PM (everyone)");
  console.log("   🌙 Night reminders: 8:00 PM (everyone)");
  console.log("   🧹 Daily cleanup: 12:00 AM (midnight)");
};