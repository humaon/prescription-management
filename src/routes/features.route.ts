import { Router } from "express";
import {
  addExpense,
  addFamilyMember,
  deleteExpense,
  deleteFamilyMember,
  getAdherence,
  getExpenses,
  getExpenseSummary,
  getFamilyMembers,
  getGenericSuggestion,
  getMedicineTakenHistory,
  getTodayLogs,
  logMedicineTaken,
  runRefillReminderCron,
} from "../controllers/features.controller";
import { authenticate } from "../middleware/authenticate.middleware";

const router = Router();

// Family members
router.post("/family", authenticate, addFamilyMember);
router.get("/family", authenticate, getFamilyMembers);
router.delete("/family/:id", authenticate, deleteFamilyMember);

// Medicine taken log + adherence
router.post("/medicines/log", authenticate, logMedicineTaken);
router.get("/medicines/today", authenticate, getTodayLogs);
router.get("/medicines/adherence", authenticate, getAdherence);
router.get("/medicines/history", authenticate, getMedicineTakenHistory);

// Generic medicine suggestion
router.get("/medicines/generic", authenticate, getGenericSuggestion);

// Medical expense tracker
router.post("/expenses", authenticate, addExpense);
router.get("/expenses", authenticate, getExpenses);
router.get("/expenses/summary", authenticate, getExpenseSummary);
router.delete("/expenses/:id", authenticate, deleteExpense);

// Refill reminder cron (called by cron-job.org)
router.post("/cron/reminders/refill", runRefillReminderCron);

export default router;
