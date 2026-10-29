import { Types } from "mongoose";
import { appConfig } from "../config/app.config";
import { geminiJson } from "../lib/gemini";
import { FamilyMemberModel, Relation } from "../models/familyMember.model";
import { MedicalExpenseModel, ExpenseCategory } from "../models/medicalExpense.model";
import { MedicineTakenLogModel } from "../models/medicineTakenLog.model";
import { ReminderModel } from "../models/reminder.model";
import { User } from "../models/user.model";
import { currencyForCountry } from "../lib/currency";
import { getUserFCMTokens } from "./fcm.service";
import { sendMedicationReminder } from "./notification.service";

// ─────────────────────────────────────────────
// FAMILY MEMBER SERVICES
// ─────────────────────────────────────────────

export const addFamilyMemberService = async (
  userId: string,
  data: { name: string; relation: Relation; dateOfBirth?: string; gender?: "M" | "F"; bloodGroup?: string }
) => {
  const member = await FamilyMemberModel.create({
    userId: new Types.ObjectId(userId),
    ...data,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
  });
  return member;
};

export const getFamilyMembersService = async (userId: string) => {
  return FamilyMemberModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
};

export const deleteFamilyMemberService = async (userId: string, memberId: string) => {
  return FamilyMemberModel.findOneAndDelete({
    _id: new Types.ObjectId(memberId),
    userId: new Types.ObjectId(userId),
  });
};

// ─────────────────────────────────────────────
// MEDICINE TAKEN LOG SERVICES
// ─────────────────────────────────────────────

export const logMedicineTakenService = async (
  userId: string,
  data: {
    reminderId: string;
    prescriptionId: string;
    medicineName: string;
    dosage: string;
    timeSlot: "morning" | "noon" | "night";
    status: "taken" | "skipped" | "delayed";
    scheduledDate: string;
    note?: string;
  }
) => {
  const scheduledDate = new Date(data.scheduledDate);
  scheduledDate.setUTCHours(0, 0, 0, 0);

  const log = await MedicineTakenLogModel.findOneAndUpdate(
    {
      userId: new Types.ObjectId(userId),
      reminderId: new Types.ObjectId(data.reminderId),
      scheduledDate,
      timeSlot: data.timeSlot,
    },
    {
      prescriptionId: new Types.ObjectId(data.prescriptionId),
      medicineName: data.medicineName,
      dosage: data.dosage,
      status: data.status,
      takenAt: data.status === "taken" ? new Date() : null,
      note: data.note || null,
    },
    { upsert: true, new: true }
  );
  return log;
};

export const getTodayLogsService = async (userId: string, dateStr?: string) => {
  const day = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(day.getTime())) throw new Error("Invalid date");
  day.setUTCHours(0, 0, 0, 0);
  return MedicineTakenLogModel.find({
    userId: new Types.ObjectId(userId),
    scheduledDate: day,
  }).select("reminderId timeSlot status takenAt");
};

export const getAdherenceService = async (userId: string, days = 30) => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await MedicineTakenLogModel.find({
    userId: new Types.ObjectId(userId),
    scheduledDate: { $gte: since },
  });

  const total = logs.length;
  const taken = logs.filter((l) => l.status === "taken").length;
  const skipped = logs.filter((l) => l.status === "skipped").length;
  const delayed = logs.filter((l) => l.status === "delayed").length;
  const missed = logs.filter((l) => l.status === "missed").length;
  const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

  // Per medicine breakdown
  const byMedicine: Record<string, { taken: number; skipped: number; delayed: number; missed: number; total: number }> = {};
  for (const log of logs) {
    if (!byMedicine[log.medicineName]) {
      byMedicine[log.medicineName] = { taken: 0, skipped: 0, delayed: 0, missed: 0, total: 0 };
    }
    byMedicine[log.medicineName][log.status]++;
    byMedicine[log.medicineName].total++;
  }

  return {
    period: `Last ${days} days`,
    total,
    taken,
    skipped,
    delayed,
    missed,
    adherenceRate,
    byMedicine,
    message:
      adherenceRate >= 90
        ? "চমৎকার! আপনি নিয়মিত ওষুধ খাচ্ছেন।"
        : adherenceRate >= 70
        ? "ভালো, তবে আরও নিয়মিত হওয়া দরকার।"
        : "সতর্কতা: অনিয়মিত ওষুধ সেবন স্বাস্থ্যের জন্য ক্ষতিকর।",
  };
};

export const getMedicineTakenHistoryService = async (
  userId: string,
  page = 1,
  limit = 20
) => {
  const skip = (page - 1) * limit;
  const logs = await MedicineTakenLogModel.find({ userId: new Types.ObjectId(userId) })
    .sort({ scheduledDate: -1 })
    .skip(skip)
    .limit(limit);

  const total = await MedicineTakenLogModel.countDocuments({ userId: new Types.ObjectId(userId) });

  return { logs, total, page, pages: Math.ceil(total / limit) };
};

// ─────────────────────────────────────────────
// GENERIC MEDICINE SUGGESTION
// ─────────────────────────────────────────────

export const getGenericSuggestionService = async (medicineName: string) => {
  const safeName = Array.from(medicineName)
    .filter((c) => c !== '"' && c !== "\\" && c !== "\n" && c !== "\r")
    .join("")
    .trim()
    .slice(0, 80);

  const prompt = `You are a pharmacist expert in the Bangladesh medicine market.

For the medicine "${safeName}", provide:
1. The generic name (active ingredient)
2. Up to 4 alternative brand names available in Bangladesh
3. Approximate price in BDT for each
4. A short note about safe substitution

Return JSON exactly like:
{
  "originalMedicine": "${safeName}",
  "genericName": "active ingredient name",
  "alternatives": [
    {"brandName": "Name", "manufacturer": "Company", "approximatePriceBDT": "1.20 per tablet", "note": "short note"}
  ],
  "substitutionNote": "Short note on whether these can be substituted safely"
}
If you do not recognise the medicine, return an empty alternatives array and say so in substitutionNote.`;

  return geminiJson<any>(prompt, undefined, 30000);
};

// ─────────────────────────────────────────────
// MEDICAL EXPENSE TRACKER
// ─────────────────────────────────────────────

export const addExpenseService = async (
  userId: string,
  data: {
    category: ExpenseCategory;
    amount: number;
    description: string;
    date: string;
    familyMemberId?: string;
    prescriptionId?: string;
    note?: string;
  }
) => {
  return MedicalExpenseModel.create({
    userId: new Types.ObjectId(userId),
    category: data.category,
    amount: data.amount,
    description: data.description,
    date: new Date(data.date),
    familyMemberId: data.familyMemberId ? new Types.ObjectId(data.familyMemberId) : null,
    prescriptionId: data.prescriptionId ? new Types.ObjectId(data.prescriptionId) : null,
    note: data.note || null,
  });
};

export const getExpensesService = async (
  userId: string,
  filters: { category?: ExpenseCategory; month?: string; year?: string; page?: number; limit?: number }
) => {
  const query: any = { userId: new Types.ObjectId(userId) };

  if (filters.category) query.category = filters.category;

  if (filters.month && filters.year) {
    const y = parseInt(filters.year);
    const m = parseInt(filters.month) - 1;
    query.date = { $gte: new Date(y, m, 1), $lt: new Date(y, m + 1, 1) };
  } else if (filters.year) {
    const y = parseInt(filters.year);
    query.date = { $gte: new Date(y, 0, 1), $lt: new Date(y + 1, 0, 1) };
  }

  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    MedicalExpenseModel.find(query).sort({ date: -1 }).skip(skip).limit(limit),
    MedicalExpenseModel.countDocuments(query),
  ]);

  return { expenses, total, page, pages: Math.ceil(total / limit) };
};

export const getExpenseSummaryService = async (userId: string) => {
  const uid = new Types.ObjectId(userId);
  const now = new Date();
  const userDoc = await User.findById(uid).select("country currency");
  const currency = userDoc?.currency || "BDT";
  const symbol = currencyForCountry(userDoc?.country).symbol;

  // This month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [thisMonth, lastMonth, thisYear, allTime] = await Promise.all([
    MedicalExpenseModel.aggregate([
      { $match: { userId: uid, date: { $gte: thisMonthStart } } },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    MedicalExpenseModel.aggregate([
      { $match: { userId: uid, date: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    MedicalExpenseModel.aggregate([
      { $match: { userId: uid, date: { $gte: yearStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    MedicalExpenseModel.aggregate([
      { $match: { userId: uid } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const byCategory: Record<string, { total: number; count: number }> = {};
  let thisMonthTotal = 0;
  for (const cat of thisMonth) {
    byCategory[cat._id] = { total: cat.total, count: cat.count };
    thisMonthTotal += cat.total;
  }

  const lastMonthTotal = lastMonth[0]?.total || 0;
  const changePercent = lastMonthTotal > 0
    ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
    : 0;

  // Last 6 months trend
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const monthlyTrend = await MedicalExpenseModel.aggregate([
    { $match: { userId: uid, date: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { year: { $year: "$date" }, month: { $month: "$date" } },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const formattedTrend = monthlyTrend.map((m) => ({
    month: `${months[m._id.month - 1]} ${m._id.year}`,
    total: m.total,
    count: m.count,
  }));

  return {
    thisMonth: {
      total: thisMonthTotal,
      byCategory,
      changeFromLastMonth: changePercent,
    },
    lastMonthTotal,
    thisYearTotal: thisYear[0]?.total || 0,
    allTimeTotal: allTime[0]?.total || 0,
    monthlyTrend: formattedTrend,
    currency,
    currencySymbol: symbol,
  };
};

export const deleteExpenseService = async (userId: string, expenseId: string) => {
  return MedicalExpenseModel.findOneAndDelete({
    _id: new Types.ObjectId(expenseId),
    userId: new Types.ObjectId(userId),
  });
};

// ─────────────────────────────────────────────
// REFILL REMINDER CRON
// ─────────────────────────────────────────────

export const runRefillReminders = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  // Find reminders where refillDate is within next 3 days and not yet sent
  const reminders = await ReminderModel.find({
    isActive: true,
    refillReminderSent: false,
    refillDate: { $lte: threeDaysLater },
  }).populate("userId");

  console.log(`💊 Checking refill reminders — found ${reminders.length} due`);

  for (const reminder of reminders) {
    try {
      const tokens = await getUserFCMTokens(reminder.userId.toString());
      if (!tokens.length) continue;

      const daysLeft = Math.ceil(
        (reminder.refillDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const overrideMsg = {
        type: "refill",
        title: "💊 ওষুধ শেষ হয়ে আসছে!",
        body: daysLeft <= 0
          ? `${reminder.medicineName} শেষ হয়ে গেছে। আজই কিনুন।`
          : `${reminder.medicineName} আর ${daysLeft} দিনের বাকি। কিনে রাখুন।`,
      };

      for (const token of tokens) {
        await sendMedicationReminder(token, {
          userId: reminder.userId,
          medicineName: reminder.medicineName,
          dosage: reminder.dosage,
          timeSlot: "morning",
          prescriptionId: reminder.prescriptionId,
        }, overrideMsg);
      }

      await ReminderModel.findByIdAndUpdate(reminder._id, { refillReminderSent: true });
      console.log(`✅ Refill reminder sent for ${reminder.medicineName}`);
    } catch (err) {
      console.error(`❌ Refill reminder failed for ${reminder._id}:`, err);
    }
  }

  return { processed: reminders.length };
};
