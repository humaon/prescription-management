import rateLimit from "express-rate-limit";

// Active in production (or when RATE_LIMIT=on) so local development and tests are not throttled.
const enabled = () =>
  process.env.NODE_ENV === "production" || process.env.RATE_LIMIT === "on";

const make = (
  windowMs: number,
  limit: number,
  message: string,
  skipPaths: string[] = []
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !enabled() || skipPaths.some((p) => req.path.startsWith(p)),
    message: { error: message },
  });

// Everything: generous per-IP ceiling (cron endpoints are authenticated separately)
export const apiLimiter = make(
  15 * 60 * 1000,
  600,
  "Too many requests. Please slow down.",
  ["/cron", "/api/cron", "/api/health"]
);

// Login / signup: slows password guessing
export const authLimiter = make(
  15 * 60 * 1000,
  30,
  "Too many attempts. Please try again in a few minutes."
);

// Each request sends an email, so keep this tight to prevent email spam / quota burn
export const otpLimiter = make(
  60 * 60 * 1000,
  8,
  "Too many verification codes requested. Please try again later."
);
