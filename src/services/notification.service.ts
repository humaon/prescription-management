// src/services/notification.service.ts

import admin from "firebase-admin";
import { Types } from "mongoose";

let firebaseInitialized = false;

export const initializeFirebase = () => {
  if (firebaseInitialized) return;

  try {
    console.log("🔧 Initializing Firebase with environment variables...");
    
    // Validate required environment variables
    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new Error("FIREBASE_PROJECT_ID environment variable is required");
    }
    if (!process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error("FIREBASE_CLIENT_EMAIL environment variable is required");
    }
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error("FIREBASE_PRIVATE_KEY environment variable is required");
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });

    firebaseInitialized = true;
    console.log("✅ Firebase Admin SDK initialized successfully");
    console.log(`📋 Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
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
}

export const sendMedicationReminder = async (
  fcmToken: string,
  notification: MedicationNotification
): Promise<void> => {
  if (!firebaseInitialized) {
    throw new Error("Firebase not initialized");
  }

  const timeEmoji = { morning: "🌅", noon: "☀️", night: "🌙" };

  const message: admin.messaging.Message = {
    token: fcmToken,
    notification: {
      title: `${timeEmoji[notification.timeSlot]} Time to Take Your Medicine`,
      body: `${notification.medicineName} - ${notification.dosage}`,
    },
    data: {
      type: "medication_reminder",
      medicineName: notification.medicineName,
      dosage: notification.dosage,
      timeSlot: notification.timeSlot,
      userId: notification.userId.toString(),
      prescriptionId: notification.prescriptionId?.toString() || "",
      timestamp: new Date().toISOString(),
    },
    android: {
      priority: "high",
      notification: {
        channelId: "alarm_channel",
        sound: "alarm_sound",
        priority: "high",
        icon: "ic_medication",
        color: "#4CAF50",
        tag: `med_${notification.medicineName}`,
        visibility: "public",
      },
    },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
      payload: {
        aps: {
          alert: {
            title: `${timeEmoji[notification.timeSlot]} Time to Take Your Medicine`,
            body: `${notification.medicineName} - ${notification.dosage}`,
          },
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
    
    if (error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered") {
      throw new Error("INVALID_TOKEN");
    }
    
    throw error;
  }
};