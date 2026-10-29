import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

// Cron endpoints (reminders, refill, missed-dose) must only be callable by your scheduler.
// Set CRON_SECRET and send it as the `x-cron-secret` header (cron-job.org supports custom headers).
export function cronAuth(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({ error: "CRON_SECRET is not configured" });
      return;
    }
    next();
    return;
  }

  const given = String(req.headers["x-cron-secret"] || "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    next();
    return;
  }
  res.status(401).json({ error: "Invalid cron secret" });
}
