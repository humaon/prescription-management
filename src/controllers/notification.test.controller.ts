import { Request, Response } from "express";
import { sendMedicationReminder, MedicationNotification } from "../services/notification.service";
import { getUserFCMTokens } from "../services/fcm.service";

// Direct token test — no userId needed
export const testDirectToken = async (req: Request, res: Response) => {
  try {
    const { token, medicineName = "Paracetamol", dosage = "500mg", timeSlot = "morning", voice = false, language = "en" } = req.body;

    if (!token) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    const notification: MedicationNotification = {
      userId: "test-user",
      medicineName,
      dosage,
      timeSlot,
      voice: !!voice,
      language: language === "bn" ? "bn" : "en",
    };

    await sendMedicationReminder(token, notification);
    res.json({ success: true, message: "Notification sent successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

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