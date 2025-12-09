// src/services/fcm.service.ts (FIXED)
import { Types } from "mongoose";
import { User, IUser, IDeviceToken } from "../models/user.model"; // Fixed import

export interface RegisterFCMTokenInput {
  userId: string;
  token: string;
  platform: "android" | "ios" | "web";
  deviceId: string;
}

/**
 * Register or update FCM token for a user
 */
export const registerFCMToken = async (
  input: RegisterFCMTokenInput
): Promise<void> => {
  const { userId, token, platform, deviceId } = input;

  const user = await User.findById(new Types.ObjectId(userId));

  if (!user) {
    throw new Error("User not found");
  }

  // Check if device already exists
  const existingDevice = user.deviceTokens.find(
    (dt: IDeviceToken) => dt.deviceId === deviceId
  );

  if (existingDevice) {
    // Update existing device token
    existingDevice.token = token;
    existingDevice.platform = platform;
    existingDevice.lastUsed = new Date();
    existingDevice.isActive = true;
  } else {
    // Add new device token
    user.deviceTokens.push({
      token,
      platform,
      deviceId,
      lastUsed: new Date(),
      isActive: true,
    });
  }

  await user.save();
};

/**
 * Remove FCM token (on logout)
 */
export const removeFCMToken = async (
  userId: string,
  deviceId: string
): Promise<void> => {
  const user = await User.findById(new Types.ObjectId(userId));

  if (!user) {
    throw new Error("User not found");
  }

  user.deviceTokens = user.deviceTokens.filter((dt: IDeviceToken) => dt.deviceId !== deviceId);

  await user.save();
};

/**
 * Deactivate a specific FCM token (when it's invalid)
 */
export const deactivateFCMToken = async (token: string): Promise<void> => {
  const user = await User.findOne({ "deviceTokens.token": token });

  if (!user) {
    return;
  }

  const deviceToken = user.deviceTokens.find((dt: IDeviceToken) => dt.token === token);

  if (deviceToken) {
    deviceToken.isActive = false;
    await user.save();
  }
};

/**
 * Get all active FCM tokens for a user
 */
export const getUserFCMTokens = async (userId: string): Promise<string[]> => {
  const user = await User.findById(new Types.ObjectId(userId));

  if (!user || !user.notificationSettings.pushNotifications) {
    return [];
  }

  return user.deviceTokens.filter((dt: IDeviceToken) => dt.isActive).map((dt: IDeviceToken) => dt.token);
};

/**
 * Update user notification settings
 */
export const updateNotificationSettings = async (
  userId: string,
  settings: Partial<IUser["notificationSettings"]>
): Promise<void> => {
  await User.findByIdAndUpdate(
    new Types.ObjectId(userId),
    {
      $set: {
        "notificationSettings.enabled":
          settings.enabled ?? undefined,
        "notificationSettings.medicationReminders":
          settings.medicationReminders ?? undefined,
        "notificationSettings.emailNotifications":
          settings.emailNotifications ?? undefined,
        "notificationSettings.pushNotifications":
          settings.pushNotifications ?? undefined,
      },
    },
    { new: true }
  );
};

/**
 * Get user notification settings
 */
export const getNotificationSettings = async (
  userId: string
): Promise<IUser["notificationSettings"] | null> => {
  const user = await User.findById(new Types.ObjectId(userId)).select(
    "notificationSettings"
  );

  return user?.notificationSettings || null;
};

/**
 * Clean up inactive tokens (run daily via cron)
 */
export const cleanupInactiveTokens = async (): Promise<void> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Remove tokens not used in 30 days
  await User.updateMany(
    {},
    {
      $pull: {
        deviceTokens: {
          lastUsed: { $lt: thirtyDaysAgo },
          isActive: false,
        },
      },
    }
  );

  console.log("✅ Cleaned up inactive FCM tokens");
};