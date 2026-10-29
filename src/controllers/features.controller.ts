import { Request, Response } from "express";
import { createServiceError, createSuccessResponse } from "../lib/utils";
import { TtlCache } from "../lib/ttlCache";
import { withAiQuota } from "../services/aiQuota.service";

const genericCache = new TtlCache<any>(30 * 24 * 60 * 60 * 1000);
import {
  addExpenseService,
  addFamilyMemberService,
  deleteExpenseService,
  deleteFamilyMemberService,
  getAdherenceService,
  getExpenseSummaryService,
  getExpensesService,
  getFamilyMembersService,
  getGenericSuggestionService,
  getMedicineTakenHistoryService,
  getTodayLogsService,
  logMedicineTakenService,
  runRefillReminders,
} from "../services/features.service";

// ── FAMILY MEMBERS ──────────────────────────

export const addFamilyMember = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const { name, relation, dateOfBirth, gender, bloodGroup } = req.body;
  if (!name || !relation) throw createServiceError("name and relation are required", 400);
  const member = await addFamilyMemberService(req.userId, { name, relation, dateOfBirth, gender, bloodGroup });
  res.status(201).json(createSuccessResponse(member, "Family member added"));
};

export const getFamilyMembers = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const members = await getFamilyMembersService(req.userId);
  res.json(createSuccessResponse(members, "Family members retrieved"));
};

export const deleteFamilyMember = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const deleted = await deleteFamilyMemberService(req.userId, req.params.id);
  if (!deleted) throw createServiceError("Family member not found", 404);
  res.json(createSuccessResponse(null, "Family member removed"));
};

// ── MEDICINE TAKEN LOG ───────────────────────

export const logMedicineTaken = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const { reminderId, prescriptionId, medicineName, dosage, timeSlot, status, scheduledDate, note } = req.body;
  if (!reminderId || !prescriptionId || !medicineName || !timeSlot || !status || !scheduledDate) {
    throw createServiceError("Missing required fields", 400);
  }
  if (!["taken", "skipped", "delayed"].includes(status)) {
    throw createServiceError("status must be taken, skipped, or delayed", 400);
  }
  const log = await logMedicineTakenService(req.userId, {
    reminderId, prescriptionId, medicineName, dosage: dosage || "", timeSlot, status, scheduledDate, note,
  });
  res.status(201).json(createSuccessResponse(log, `Medicine marked as ${status}`));
};

export const getTodayLogs = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  try {
    const logs = await getTodayLogsService(req.userId, req.query.date as string | undefined);
    res.json(createSuccessResponse(logs, "Today's dose logs retrieved"));
  } catch (e: any) {
    throw createServiceError(e.message, 400);
  }
};

export const getAdherence = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const days = parseInt(req.query.days as string) || 30;
  const stats = await getAdherenceService(req.userId, days);
  res.json(createSuccessResponse(stats, "Adherence statistics retrieved"));
};

export const getMedicineTakenHistory = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const history = await getMedicineTakenHistoryService(req.userId, page, limit);
  res.json(createSuccessResponse(history, "Medicine history retrieved"));
};

// ── GENERIC MEDICINE SUGGESTION ──────────────

export const getGenericSuggestion = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const { name } = req.query;
  if (!name || typeof name !== "string") throw createServiceError("Medicine name is required", 400);
  const key = name.trim().toLowerCase();
  let suggestion = genericCache.get(key);
  if (!suggestion) {
    const userId = req.userId;
    suggestion = await withAiQuota(userId, "generic", () =>
      getGenericSuggestionService(name)
    );
    genericCache.set(key, suggestion);
  }
  res.json(createSuccessResponse(suggestion, "Generic alternatives found"));
};

// ── MEDICAL EXPENSE TRACKER ──────────────────

export const addExpense = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const { category, amount, description, date, familyMemberId, prescriptionId, note } = req.body;
  if (!category || !amount || !description || !date) {
    throw createServiceError("category, amount, description, date are required", 400);
  }
  if (!["consultation", "medicine", "test", "other"].includes(category)) {
    throw createServiceError("category must be: consultation, medicine, test, or other", 400);
  }
  if (typeof amount !== "number" || amount < 0) {
    throw createServiceError("amount must be a positive number", 400);
  }
  const expense = await addExpenseService(req.userId, { category, amount, description, date, familyMemberId, prescriptionId, note });
  res.status(201).json(createSuccessResponse(expense, "Expense added"));
};

export const getExpenses = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const { category, month, year, page, limit } = req.query;
  const result = await getExpensesService(req.userId, {
    category: category as any,
    month: month as string,
    year: year as string,
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  });
  res.json(createSuccessResponse(result, "Expenses retrieved"));
};

export const getExpenseSummary = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const summary = await getExpenseSummaryService(req.userId);
  res.json(createSuccessResponse(summary, "Expense summary retrieved"));
};

export const deleteExpense = async (req: Request, res: Response) => {
  if (!req.userId) throw createServiceError("Unauthorized", 401);
  const deleted = await deleteExpenseService(req.userId, req.params.id);
  if (!deleted) throw createServiceError("Expense not found", 404);
  res.json(createSuccessResponse(null, "Expense deleted"));
};

// ── REFILL CRON ──────────────────────────────

export const runRefillReminderCron = async (req: Request, res: Response) => {
  const result = await runRefillReminders();
  res.json(createSuccessResponse(result, "Refill reminders processed"));
};
