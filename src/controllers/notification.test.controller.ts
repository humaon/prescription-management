import { Request, Response } from "express";
import { sendMedicationReminder, MedicationNotification } from "../services/notification.service";
import { getUserFCMTokens } from "../services/fcm.service";

export const testSendReminder = async (req: Request, res: Response) => {
  try {
    const { userId, medicineName, dosage, timeSlot = "morning" } = req.body;

    if (!userId || !medicineName || !dosage) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // get user's FCM tokens
    const tokens = await getUserFCMTokens(userId);
    if (!tokens.length) {
      return res.status(400).json({ message: "No FCM tokens for this user" });
    }

    const notification: MedicationNotification = {
      userId,
      medicineName,
      dosage,
      timeSlot,
    };

    let results: any[] = [];

    for (const token of tokens) {
      try {
        await sendMedicationReminder(token, notification);
        results.push({ token, status: "SENT" });
      } catch (err: any) {
        results.push({ token, status: "FAILED", error: err.message });
      }
    }

    res.json({
      message: "Notification test completed",
      results,
    });

  } catch (err) {
    console.error("❌ Test notification error:", err);
    res.status(500).json({ message: "Internal error", error: err });
  }
};