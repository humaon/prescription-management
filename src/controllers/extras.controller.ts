import { Request, Response } from "express";
import fs from "fs/promises";
import { createServiceError, createSuccessResponse } from "../lib/utils";
import { claimAdReward, getAiUsage } from "../services/aiQuota.service";
import {
  acceptCareLinkService,
  getPatientTodayService,
  inviteCaregiverService,
  listCareLinksService,
  removeCareLinkService,
  runMissedDoseCheck,
} from "../services/care.service";
import {
  analyzeLabReportService,
  checkInteractionsService,
  getEmergencyCardService,
  getLabTrendService,
  getVisitCardService,
  listLabReportsService,
  updateEmergencyCardService,
  updatePreferencesService,
} from "../services/health.service";

const uid = (req: Request) => {
  if (!req.userId) throw createServiceError("User not authenticated", 401);
  return req.userId;
};

// Service-layer Errors carry user-facing messages; surface them as 400s.
const asBadRequest = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e: any) {
    if (e?.statusCode) throw e;
    throw createServiceError(e?.message || "Request failed", 400);
  }
};

// ── Caregivers ──
export const inviteCaregiver = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) throw createServiceError("email is required", 400);
  const link = await asBadRequest(() => inviteCaregiverService(uid(req), email));
  res.status(201).json(createSuccessResponse(link, "Invitation sent"));
};

export const listCareLinks = async (req: Request, res: Response) => {
  res.json(createSuccessResponse(await listCareLinksService(uid(req)), "Care links retrieved"));
};

export const acceptCareLink = async (req: Request, res: Response) => {
  const link = await asBadRequest(() => acceptCareLinkService(uid(req), req.params.id));
  res.json(createSuccessResponse(link, "You are now a caregiver"));
};

export const removeCareLink = async (req: Request, res: Response) => {
  const removed = await removeCareLinkService(uid(req), req.params.id);
  if (!removed) throw createServiceError("Link not found", 404);
  res.json(createSuccessResponse(null, "Removed"));
};

export const getPatientToday = async (req: Request, res: Response) => {
  const data = await asBadRequest(() => getPatientTodayService(uid(req), req.params.patientId));
  res.json(createSuccessResponse(data, "Patient status retrieved"));
};

export const runMissedDoseCron = async (req: Request, res: Response) => {
  const slot = req.params.slot as "morning" | "noon" | "night";
  if (!["morning", "noon", "night"].includes(slot)) {
    throw createServiceError("slot must be morning, noon or night", 400);
  }
  const onlyUser = typeof req.query.userId === "string" ? req.query.userId : undefined;
  res.json(createSuccessResponse(await runMissedDoseCheck(slot, onlyUser), "Missed-dose check done"));
};

// ── Lab reports ──
export const uploadLabReport = async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!req.file) throw createServiceError("Report image is required (field: report)", 400);
  try {
    const report = await asBadRequest(() =>
      analyzeLabReportService(userId, req.file!.path, req.body.familyMemberId)
    );
    res.status(201).json(createSuccessResponse(report, "Lab report analyzed"));
  } finally {
    await fs.unlink(req.file.path).catch(() => {});
  }
};

export const listLabReports = async (req: Request, res: Response) => {
  res.json(createSuccessResponse(await listLabReportsService(uid(req)), "Lab reports retrieved"));
};

export const getLabTrend = async (req: Request, res: Response) => {
  const test = req.query.test;
  if (!test || typeof test !== "string") throw createServiceError("test query is required", 400);
  res.json(createSuccessResponse(await getLabTrendService(uid(req), test), "Trend retrieved"));
};

// ── Interactions / visit card ──
export const checkInteractions = async (req: Request, res: Response) => {
  const extra =
    typeof req.query.extra === "string"
      ? req.query.extra.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10)
      : [];
  const data = await asBadRequest(() =>
    checkInteractionsService(uid(req), req.query.familyMemberId as string | undefined, extra)
  );
  res.json(createSuccessResponse(data, "Interaction check complete"));
};

export const getVisitCard = async (req: Request, res: Response) => {
  const data = await getVisitCardService(uid(req), req.query.familyMemberId as string | undefined);
  res.json(createSuccessResponse(data, "Visit card generated"));
};

// ── Emergency card / preferences ──
export const getEmergencyCard = async (req: Request, res: Response) => {
  res.json(createSuccessResponse(await getEmergencyCardService(uid(req)), "Emergency card retrieved"));
};

export const updateEmergencyCard = async (req: Request, res: Response) => {
  res.json(createSuccessResponse(await updateEmergencyCardService(uid(req), req.body), "Emergency card updated"));
};

export const updatePreferences = async (req: Request, res: Response) => {
  res.json(createSuccessResponse(await updatePreferencesService(uid(req), req.body), "Preferences updated"));
};

// ── AI usage (daily free limits) ──
export const getUsage = async (req: Request, res: Response) => {
  res.json(createSuccessResponse(await getAiUsage(uid(req)), "AI usage retrieved"));
};

export const claimReward = async (req: Request, res: Response) => {
  res.json(createSuccessResponse(await claimAdReward(uid(req)), "Reward added"));
};
