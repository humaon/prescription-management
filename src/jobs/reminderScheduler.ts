// src/jobs/reminderScheduler.ts
import cron from "node-cron";
import { getDueRemindersService } from "../services/prescription.service";
import { ReminderModel } from "../models/reminder.model";

const sendNotification = async (
  userId: string,
  medicineName: string,
  dosage: string,
  timeSlot: string
) => {
  console.log(
    `[REMINDER] User ${userId}: Take ${medicineName} (${dosage}) - ${timeSlot}`
  );

  // TODO: Implement actual notification
  // - Push notification (Firebase, OneSignal)
  // - Email
  // - SMS
  // - In-app notification
};

// Morning reminders - 8:00 AM
const scheduleMorningReminders = () => {
  cron.schedule("0 8 * * *", async () => {
    console.log("Running morning medication reminders...");

    try {
      const reminders = await getDueRemindersService("morning");

      for (const reminder of reminders) {
        await sendNotification(
          reminder.userId.toString(),
          reminder.medicineName,
          reminder.dosage,
          "Morning"
        );

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

// Noon reminders - 1:00 PM
const scheduleNoonReminders = () => {
  cron.schedule("0 13 * * *", async () => {
    console.log("Running noon medication reminders...");

    try {
      const reminders = await getDueRemindersService("noon");

      for (const reminder of reminders) {
        await sendNotification(
          reminder.userId.toString(),
          reminder.medicineName,
          reminder.dosage,
          "Noon"
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

// Night reminders - 8:00 PM
const scheduleNightReminders = () => {
  cron.schedule("0 20 * * *", async () => {
    console.log("Running night medication reminders...");

    try {
      const reminders = await getDueRemindersService("night");

      for (const reminder of reminders) {
        await sendNotification(
          reminder.userId.toString(),
          reminder.medicineName,
          reminder.dosage,
          "Night"
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

// Initialize all schedulers
export const initializeReminderSchedulers = () => {
  scheduleMorningReminders();
  scheduleNoonReminders();
  scheduleNightReminders();
  console.log("✅ Medication reminder schedulers initialized");
  console.log("   - Morning reminders: 8:00 AM");
  console.log("   - Noon reminders: 1:00 PM");
  console.log("   - Night reminders: 8:00 PM");
};