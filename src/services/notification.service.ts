// src/services/notification.service.ts

import admin from "firebase-admin";
import { Types } from "mongoose";
import { appConfig } from "../config/app.config";

let firebaseInitialized = false;

export const initializeFirebase = () => {
  if (firebaseInitialized) return;

  try {
    console.log("🔧 Initializing Firebase with environment variables...");

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: appConfig.FIREBASE_PROJECT_ID,
        privateKey: appConfig.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        clientEmail: appConfig.FIREBASE_CLIENT_EMAIL,
      }),
    });

    firebaseInitialized = true;
    console.log("✅ Firebase Admin SDK initialized successfully");
    console.log(`📋 Project ID: ${appConfig.FIREBASE_PROJECT_ID}`);
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
    throw error;
  }
};

export interface MedicationNotification {
  userId: string | Types.ObjectId;
  medicineName: string;
  dosage: string;
  timeSlot: "morning" | "noon" | "night";
  prescriptionId?: string | Types.ObjectId;
  language?: "en" | "bn";
  voice?: boolean;
}

const SLOT_BN = { morning: "সকালের", noon: "দুপুরের", night: "রাতের" };

export const sendMedicationReminder = async (
  fcmToken: string,
  notification: MedicationNotification,
  override?: { type?: string; title?: string; body?: string; extra?: Record<string, string> }
): Promise<void> => {
  if (!firebaseInitialized) {
    throw new Error("Firebase not initialized");
  }

  const timeEmoji = { morning: "🌅", noon: "☀️", night: "🌙" };
  const isBn = notification.language === "bn";

  const defaultTitle = isBn
    ? `${timeEmoji[notification.timeSlot]} ${SLOT_BN[notification.timeSlot]} ওষুধের সময়`
    : `${timeEmoji[notification.timeSlot]} Time to Take Your Medicine`;
  const title = override?.title ?? defaultTitle;
  const body = override?.body ?? `${notification.medicineName} - ${notification.dosage}`;
  const speakText = isBn
    ? `এখন ${SLOT_BN[notification.timeSlot]} ওষুধ খাওয়ার সময়। ${notification.medicineName}, ${notification.dosage}।`
    : `Time to take your ${notification.timeSlot} medicine. ${notification.medicineName}, ${notification.dosage}.`;

  const message: admin.messaging.Message = {
    token: fcmToken,
    // Voice reminders are data-only on Android so the app can speak the text
    // (a notification payload would be shown by the system without running our code).
    ...(notification.voice ? {} : { notification: { title, body } }),
    data: {
      title,
      body,
      voice: notification.voice ? "1" : "0",
      type: override?.type ?? "medication_reminder",
      medicineName: notification.medicineName,
      dosage: notification.dosage,
      timeSlot: notification.timeSlot,
      userId: notification.userId.toString(),
      prescriptionId: notification.prescriptionId?.toString() || "",
      language: notification.language || "en",
      speakText,
      timestamp: new Date().toISOString(),
      ...(override?.extra || {}),
    },
    android: {
      priority: "high",
      // Any android.notification field turns this into a system-displayed notification
      // message, so voice (data-only) messages must not carry it.
      ...(notification.voice
        ? {}
        : {
            notification: {
              channelId: "alarm_channel",
              sound: "alarm_sound",
              priority: "high" as const,
              icon: "ic_medication",
              color: "#4CAF50",
              tag: `med_${notification.medicineName}`,
              visibility: "public" as const,
            },
          }),
    },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
      payload: {
        aps: {
          alert: { title, body },
          sound: "default",
          badge: 1,
          category: "MEDICATION_REMINDER",
          threadId: `medication_${notification.medicineName}`,
          contentAvailable: true,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`✅ Notification sent successfully:`, response);
  } catch (error: any) {
    console.error(`❌ Error sending notification:`, error);

    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      throw new Error("INVALID_TOKEN");
    }

    throw error;
  }
};

export interface FollowUpNotification {
  userId: string | Types.ObjectId;
  prescriptionId: string | Types.ObjectId;
  doctorName: string | null;
  date: string; // YYYY-MM-DD
  note: string | null;
  when: "tomorrow" | "today";
  // Tests from that prescription: still to do, or reports to bring
  pendingTests?: string[];
  hasReports?: boolean;
}

const sendSimple = async (
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  tag: string
) => {
  if (!firebaseInitialized) {
    throw new Error("Firebase not initialized");
  }
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: { ...data, timestamp: new Date().toISOString() },
      android: { priority: "high", notification: { icon: "ic_medication", color: "#4CAF50", tag } },
      apns: {
        headers: { "apns-priority": "10", "apns-push-type": "alert" },
        payload: { aps: { alert: { title, body }, sound: "default" } },
      },
    });
  } catch (error: any) {
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      throw new Error("INVALID_TOKEN");
    }
    throw error;
  }
};

// "Tests still pending" nudge, one per prescription
export const sendPendingTestsReminder = (
  fcmToken: string,
  n: { userId: string; prescriptionId: string; testNames: string[]; doctorName: string | null; days: number }
) =>
  sendSimple(
    fcmToken,
    `🧪 ${n.testNames.length === 1 ? "A test is" : `${n.testNames.length} tests are`} still pending`,
    [
      n.testNames.join(", "),
      n.doctorName ? `prescribed by ${n.doctorName} ${n.days} days ago` : `prescribed ${n.days} days ago`,
    ].join(" · "),
    { type: "pending_tests_reminder", prescriptionId: n.prescriptionId, userId: n.userId },
    `tests_${n.prescriptionId}`
  );

// A tracked medicine is about to run out
export const sendRefillReminder = (
  fcmToken: string,
  n: { userId: string; reminderId: string; medicineName: string; stockCount: number; daysLeft: number }
) =>
  sendSimple(
    fcmToken,
    `💊 ${n.medicineName} is running low`,
    n.daysLeft <= 0
      ? `Only ${n.stockCount} left — less than a day. Buy more today.`
      : `${n.stockCount} left — about ${n.daysLeft} day${n.daysLeft === 1 ? "" : "s"}. Time to buy more.`,
    { type: "refill_reminder", reminderId: n.reminderId, userId: n.userId },
    `refill_${n.reminderId}`
  );

// Reminder the day before, and on the day of, a follow-up visit
export const sendFollowUpReminder = async (
  fcmToken: string,
  notification: FollowUpNotification,
): Promise<void> => {
  if (!firebaseInitialized) {
    throw new Error("Firebase not initialized");
  }

  const title = `📅 Doctor visit ${notification.when}`;
  const body = [
    notification.doctorName ? `Follow-up with ${notification.doctorName}` : "Follow-up visit",
    notification.note,
    notification.pendingTests?.length
      ? `Tests not done yet: ${notification.pendingTests.join(", ")}`
      : notification.hasReports
        ? "Take your test reports"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const message: admin.messaging.Message = {
    token: fcmToken,
    notification: { title, body },
    data: {
      type: "follow_up_reminder",
      prescriptionId: notification.prescriptionId.toString(),
      userId: notification.userId.toString(),
      date: notification.date,
      timestamp: new Date().toISOString(),
    },
    android: {
      priority: "high",
      notification: { icon: "ic_medication", color: "#4CAF50", tag: `followup_${notification.prescriptionId}` },
    },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
      payload: { aps: { alert: { title, body }, sound: "default" } },
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (error: any) {
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      throw new Error("INVALID_TOKEN");
    }
    throw error;
  }
};
