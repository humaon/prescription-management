// CREATE NEW FILE: src/controllers/fcm.controller.ts

import { Request, Response } from "express";
import { createServiceError, createSuccessResponse } from "../lib/utils";
import {
  registerFCMToken,
  removeFCMToken,
  updateNotificationSettings,
  getNotificationSettings,
} from "../services/fcm.service";

export const registerFCMTokenController = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("User not authenticated", 401);

  const { token, platform, deviceId } = req.body;

  if (!token || !platform || !deviceId) {
    throw createServiceError("Missing required fields: token, platform, deviceId", 400);
  }

  if (!["android", "ios", "web"].includes(platform)) {
    throw createServiceError("Invalid platform. Must be: android, ios, or web", 400);
  }

  const result = await registerFCMToken({
    userId: req.userId,
    token,
    platform,
    deviceId,
  });

  res.status(200).json(createSuccessResponse(result, "FCM token registered successfully"));
};

export const removeFCMTokenController = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("User not authenticated", 401);

  const { deviceId } = req.body;
  if (!deviceId) throw createServiceError("deviceId is required", 400);

  const result = await removeFCMToken(req.userId, deviceId);
  res.status(200).json(createSuccessResponse(result, "FCM token removed successfully"));
};

export const updateNotificationSettingsController = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("User not authenticated", 401);

  const { enabled, medicationReminders, emailNotifications, pushNotifications } = req.body;

  const settings = await updateNotificationSettings(req.userId, {
    enabled,
    medicationReminders,
    emailNotifications,
    pushNotifications,
  });

  res.status(200).json(createSuccessResponse(settings, "Notification settings updated successfully"));
};

export const getNotificationSettingsController = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("User not authenticated", 401);

  const settings = await getNotificationSettings(req.userId);
  res.status(200).json(createSuccessResponse(settings, "Notification settings retrieved"));
};