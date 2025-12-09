// CREATE NEW FILE: src/services/fcm.service.ts

import { Types } from "mongoose";
import { UserModel } from "../models/user.model";

export interface RegisterTokenInput {
  userId: string;
  token: string;
  platform: "android" | "ios" | "web";
  deviceId: string;
}

export const registerFCMToken = async (input: RegisterTokenInput) => {
  const { userId, token, platform, deviceId } = input;

  const user = await UserModel.findById(userId);
  if (!user) throw new Error("User not found");

  const existingDeviceIndex = user.deviceTokens.findIndex(
    (dt) => dt.deviceId === deviceId
  );

  if (existingDeviceIndex !== -1) {
    user.deviceTokens[existingDeviceIndex].token = token;
    user.deviceTokens[existingDeviceIndex].platform = platform;
    user.deviceTokens[existingDeviceIndex].lastUsed = new Date();
    user.deviceTokens[existingDeviceIndex].isActive = true;
  } else {
    user.deviceTokens.push({
      token,
      platform,
      deviceId,
      lastUsed: new Date(),
      isActive: true,
    });
  }

  await user.save();
  return { message: "FCM token registered successfully", deviceId, platform };
};

export const removeFCMToken = async (userId: string, deviceId: string) => {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error("User not found");

  user.deviceTokens = user.deviceTokens.filter((dt) => dt.deviceId !== deviceId);
  await user.save();

  return { message: "FCM token removed successfully" };
};

export const deactivateFCMToken = async (token: string) => {
  const user = await UserModel.findOne({ "deviceTokens.token": token });
  if (!user) return;

  const deviceToken = user.deviceTokens.find((dt) => dt.token === token);
  if (deviceToken) {
    deviceToken.isActive = false;
    await user.save();
  }
};

export const getUserFCMTokens = async (
  userId: string | Types.ObjectId
): Promise<string[]> => {
  const user = await UserModel.findById(userId);
  if (!user) return [];

  if (
    !user.notificationSettings?.enabled ||
    !user.notificationSettings?.pushNotifications ||
    !user.notificationSettings?.medicationReminders
  ) {
    return [];
  }

  return user.deviceTokens.filter((dt) => dt.isActive).map((dt) => dt.token);
};

export const updateNotificationSettings = async (
  userId: string,
  settings: {
    enabled?: boolean;
    medicationReminders?: boolean;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
  }
) => {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error("User not found");

  if (!user.notificationSettings) {
    user.notificationSettings = {
      enabled: true,
      medicationReminders: true,
      emailNotifications: false,
      pushNotifications: true,
    };
  }

  Object.assign(user.notificationSettings, settings);
  await user.save();

  return user.notificationSettings;
};

export const getNotificationSettings = async (userId: string) => {
  const user = await UserModel.findById(userId).select("notificationSettings");
  if (!user) throw new Error("User not found");

  return user.notificationSettings || {
    enabled: true,
    medicationReminders: true,
    emailNotifications: false,
    pushNotifications: true,
  };
};

export const cleanupInactiveTokens = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await UserModel.updateMany(
    {},
    {
      $pull: {
        deviceTokens: {
          $or: [{ isActive: false }, { lastUsed: { $lt: thirtyDaysAgo } }]
        }
      }
    }
  );

  console.log(`✅ Cleaned up inactive tokens: ${result.modifiedCount} users updated`);
  return result;
};