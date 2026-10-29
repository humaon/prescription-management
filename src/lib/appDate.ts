// Calendar helpers in the app timezone (users are in Bangladesh; the server runs in UTC)
import { appConfig } from "../config/app.config";

const ymdFormatter = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: appConfig.APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

/** "YYYY-MM-DD" of the given instant in the app timezone */
export const ymdInAppTz = (date = new Date()): string => ymdFormatter().format(date);

/** Add whole calendar days to a "YYYY-MM-DD" string */
export const addDaysYmd = (ymd: string, days: number): string => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** Day of week (0=Sun..6=Sat) of the given instant in the app timezone */
export const weekdayInAppTz = (date = new Date()): number => {
  const [y, m, d] = ymdInAppTz(date).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** Offset (ms) of the app timezone from UTC at the given instant */
const tzOffsetMs = (date: Date): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: appConfig.APP_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/** Last millisecond of the given "YYYY-MM-DD" day in the app timezone */
export const endOfDayInAppTz = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  return new Date(guess - tzOffsetMs(new Date(guess)));
};

/** First millisecond of the given "YYYY-MM-DD" day in the app timezone */
export const startOfDayInAppTz = (ymd: string): Date =>
  new Date(endOfDayInAppTz(addDaysYmd(ymd, -1)).getTime() + 1);

/** Day of week (0=Sun..6=Sat) of a "YYYY-MM-DD" calendar day */
export const weekdayOfYmd = (ymd: string): number => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const isValidYmd = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = new Date(s + "T00:00:00Z");
  return !isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === s;
};
