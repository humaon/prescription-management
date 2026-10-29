import { Request, Response } from "express";
import { DEFAULT_REMINDER_TIMES, User } from "../models/user.model";
import { cleanAllergies } from "../lib/allergies";
import { deleteProfileDataService } from "../services/prescription.service";

const SLOTS = ["morning", "noon", "night"] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const reminderSettingsOf = (user: any) => ({
  reminderTimes: { ...DEFAULT_REMINDER_TIMES, ...(user?.reminderTimes?.toObject?.() ?? user?.reminderTimes ?? {}) },
  localAlarms: !!user?.localAlarms,
});

// Allergies of the active person (X-Profile-Id), account holder by default
export const getAllergiesController = async (req: Request, res: Response) => {
  const user = await User.findById(req.userId).select("allergies profiles").lean();
  const allergies = req.profileId
    ? user?.profiles?.find((p) => p._id.equals(req.profileId!))?.allergies
    : user?.allergies;
  res.json({ success: true, data: { allergies: allergies ?? [] } });
};

// body: { allergies: string[] } — replaces the list
export const updateAllergiesController = async (req: Request, res: Response) => {
  if (!Array.isArray(req.body?.allergies)) {
    res.status(400).json({ error: "allergies must be an array of strings" });
    return;
  }
  const allergies = cleanAllergies(req.body.allergies);
  if (req.profileId) {
    await User.updateOne(
      { _id: req.userId, "profiles._id": req.profileId },
      { $set: { "profiles.$.allergies": allergies } }
    );
  } else {
    await User.updateOne({ _id: req.userId }, { $set: { allergies } });
  }
  res.json({ success: true, data: { allergies } });
};

// ---------- Family profiles ----------
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 60) : "");
const cleanRelation = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : null);
const profileOut = (p: any) => ({ _id: p._id, name: p.name, relation: p.relation ?? null, allergies: p.allergies ?? [] });

export const listProfilesController = async (req: Request, res: Response) => {
  const user = await User.findById(req.userId).select("profiles fullName").lean();
  res.json({
    success: true,
    data: { self: { name: user?.fullName ?? "Me" }, profiles: (user?.profiles ?? []).map(profileOut) },
  });
};

// body: { name, relation? }
export const createProfileController = async (req: Request, res: Response) => {
  const name = cleanName(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const user = await User.findById(req.userId).select("profiles");
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.profiles.length >= 10) {
    res.status(400).json({ error: "Up to 10 family members can be added" });
    return;
  }
  user.profiles.push({ name, relation: cleanRelation(req.body?.relation), allergies: [] } as any);
  await user.save();
  res.status(201).json({ success: true, data: profileOut(user.profiles[user.profiles.length - 1]) });
};

// body: { name?, relation? }
export const updateProfileMemberController = async (req: Request, res: Response) => {
  const user = await User.findById(req.userId).select("profiles");
  const profile = user?.profiles.find((p) => p._id.toString() === req.params.id);
  if (!user || !profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  if (req.body?.name !== undefined) {
    const name = cleanName(req.body.name);
    if (!name) {
      res.status(400).json({ error: "name cannot be empty" });
      return;
    }
    profile.name = name;
  }
  if (req.body?.relation !== undefined) profile.relation = cleanRelation(req.body.relation);
  await user.save();
  res.json({ success: true, data: profileOut(profile) });
};

// Removes the member and everything saved for them
export const deleteProfileController = async (req: Request, res: Response) => {
  const user = await User.findById(req.userId).select("profiles");
  const profile = user?.profiles.find((p) => p._id.toString() === req.params.id);
  if (!user || !profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  await deleteProfileDataService(req.userId!, profile._id);
  user.profiles = user.profiles.filter((p) => !p._id.equals(profile._id)) as any;
  await user.save();
  res.json({ success: true, data: null });
};

export const getReminderSettingsController = async (req: Request, res: Response) => {
  const user = await User.findById(req.userId).select("reminderTimes localAlarms").lean();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ success: true, data: reminderSettingsOf(user) });
};

// body: { reminderTimes?: { morning?, noon?, night? } ("HH:MM"), localAlarms?: boolean }
export const updateReminderSettingsController = async (req: Request, res: Response) => {
  const { reminderTimes, localAlarms } = req.body ?? {};
  const update: Record<string, unknown> = {};

  if (reminderTimes !== undefined) {
    if (!reminderTimes || typeof reminderTimes !== "object") {
      res.status(400).json({ error: "reminderTimes must be an object" });
      return;
    }
    for (const slot of SLOTS) {
      const value = reminderTimes[slot];
      if (value === undefined) continue;
      if (typeof value !== "string" || !HHMM.test(value)) {
        res.status(400).json({ error: `${slot} must be HH:MM (24-hour)` });
        return;
      }
      update[`reminderTimes.${slot}`] = value;
    }
  }
  if (localAlarms !== undefined) {
    if (typeof localAlarms !== "boolean") {
      res.status(400).json({ error: "localAlarms must be a boolean" });
      return;
    }
    update.localAlarms = localAlarms;
  }

  const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true })
    .select("reminderTimes localAlarms")
    .lean();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ success: true, data: reminderSettingsOf(user) });
};

export const getProfileController = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfileController = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { fullName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { fullName },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
