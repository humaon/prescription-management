// src/lib/dosageParser.ts
//
// Rule-based fallback parser for Bangladeshi prescriptions. The AI parser is
// asked to return structured schedule fields; this module derives them from the
// free text when the AI (or an older app version) did not send them, and is also
// used for legacy medicines that were stored before the structured fields existed.

export type ScheduleType = "daily" | "weekly" | "as_needed" | "once";

export interface ParsedDosage {
  morning: boolean;
  noon: boolean;
  night: boolean;
  totalDoses: number;
  scheduleType: ScheduleType;
  asNeeded: boolean;
  /** 0=Sun..6=Sat, only for weekly */
  weekDays: number[];
  /** false when nothing recognisable was found and the morning default was used */
  matched: boolean;
}

export interface ParsedDuration {
  days: number | null;
  continueIndefinitely: boolean;
}

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Convert Bangla digits (০-৯) to ASCII digits */
export const toEnglishDigits = (text: string): string =>
  text.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));

// Bangla / English number words that show up in dosing text
const NUMBER_WORDS: [RegExp, string][] = [
  [/এক/g, "1"],
  [/দুই|দু/g, "2"],
  [/তিন/g, "3"],
  [/চার/g, "4"],
  [/পাঁচ/g, "5"],
  [/সাত/g, "7"],
  [/দশ/g, "10"],
];

/** Lowercase, Bangla digits → ASCII, unify dashes; used by every matcher below */
const clean = (text: string): string =>
  toEnglishDigits(String(text || ""))
    .replace(/[–—−]/g, "-")
    .toLowerCase();

// Same as clean() plus Bangla number words → digits (only around count units,
// to avoid mangling words like "একবার" → "1বার" which is still fine)
const withNumberWords = (text: string): string => {
  let t = clean(text);
  for (const [re, n] of NUMBER_WORDS) {
    t = t.replace(new RegExp(`(${re.source})(?=\\s*(বেলা|বার|দিন|সপ্তাহ|মাস|ডোজ|ঘণ্টা|ঘন্টা))`, "g"), n);
  }
  return t;
};

// ---------------------------------------------------------------------------
// Keyword groups
// ---------------------------------------------------------------------------
const AS_NEEDED_RE =
  /\b(sos|s\.o\.s|prn|p\.r\.n|when\s+(?:needed|required|necessary)|if\s+(?:needed|required|necessary)|as\s+(?:needed|required|directed\s+if\s+needed)|on\s+demand)\b|প্রয়োজনে|প্রয়োজন\s*হলে|প্রয়োজন\s*মত|দরকার\s*হলে|দরকারে/;
const ONCE_RE =
  /\b(stat|single\s+dose|one\s+dose\s+only|once\s+only|one\s+time\s+only|1\s*dose\s+only|single\s+shot)\b|(?:^|[^\d])1\s*ডোজ(?!\s*(?:করে|প্রতিদিন|দিনে))|একবার\s*মাত্র|1\s*বার\s*মাত্র|একটি\s*ডোজ/;
const WEEKLY_RE =
  /\b(weekly|once\s+(?:a|per|every)\s+week|every\s+week|per\s+week|(?:1|one|2|two)\s*(?:x|times?)\s*(?:a|per)\s+week|every\s+(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*)\b|সপ্তাহে\s*\d*\s*(?:বার|দিন|টি|টা)?|প্রতি\s*সপ্তাহে|প্রতি\s*(?:রবি|সোম|মঙ্গল|বুধ|বৃহস্পতি|শুক্র|শনি)বার/;

const WEEKDAY_PATTERNS: [RegExp, number][] = [
  [/\b(sunday|sun)\b|রবিবার/, 0],
  [/\b(monday|mon)\b|সোমবার/, 1],
  [/\b(tuesday|tue|tues)\b|মঙ্গলবার/, 2],
  [/\b(wednesday|wed)\b|বুধবার/, 3],
  [/\b(thursday|thu|thur|thurs)\b|বৃহস্পতিবার/, 4],
  [/\b(friday|fri)\b|শুক্রবার/, 5],
  [/\b(saturday|sat)\b|শনিবার/, 6],
];

const NIGHT_RE = /\b(night|nightly|evening|dinner|supper|bedtime|bed\s*time|hs|h\.s|nocte|qhs|at\s+bed)\b|রাতে|রাত|সন্ধ্যা|ঘুমের\s*আগে|শোয়ার\s*আগে|শোবার\s*আগে/;
const MORNING_RE = /\b(morning|breakfast|am|mane)\b|সকাল|সকালে|নাস্তা/;
const NOON_RE = /\b(noon|afternoon|lunch|midday|mid-day)\b|দুপুর|দুপুরে/;

/** Extract weekdays (0=Sun..6=Sat) mentioned in the text */
export const parseWeekDays = (text: string): number[] => {
  const t = clean(text);
  const days = WEEKDAY_PATTERNS.filter(([re]) => re.test(t)).map(([, d]) => d);
  return [...new Set(days)].sort((a, b) => a - b);
};

/** "1", "½", "1/2", "1.5" → number */
const doseValue = (tok: string): number => {
  if (tok === "½") return 0.5;
  if (tok === "¼") return 0.25;
  if (tok === "¾") return 0.75;
  if (tok.includes("/")) {
    const [a, b] = tok.split("/").map(Number);
    return b ? a / b : 0;
  }
  return parseFloat(tok) || 0;
};

const DOSE_TOKEN = "(\\d+(?:\\.\\d+)?\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?|[½¼¾])";
// 1+0+1, ½+0+½, 1-0-1, 1+1+1+1 (separators required to avoid matching "120 mg")
const PATTERN_SEP_RE = new RegExp(
  `(?<![\\d.\\/])${DOSE_TOKEN}\\s*[+\\-]\\s*${DOSE_TOKEN}\\s*[+\\-]\\s*${DOSE_TOKEN}(?:\\s*[+\\-]\\s*${DOSE_TOKEN})?(?![\\d.\\/])`
);
// "1 0 1" (single digits, space separated) — only when the whole field is that
const PATTERN_SPACE_RE = /^\s*([0-3])\s+([0-3])\s+([0-3])\s*$/;

const result = (
  morning: boolean,
  noon: boolean,
  night: boolean,
  scheduleType: ScheduleType = "daily",
  weekDays: number[] = [],
  matched = true
): ParsedDosage => ({
  morning,
  noon,
  night,
  totalDoses: (morning ? 1 : 0) + (noon ? 1 : 0) + (night ? 1 : 0),
  scheduleType,
  asNeeded: scheduleType === "as_needed",
  weekDays,
  matched,
});

/** Map "n doses a day" to slots; explicit time mentions win when they agree */
const slotsForCount = (
  count: number,
  mentions: { morning: boolean; noon: boolean; night: boolean }
): ParsedDosage => {
  const mentioned = [mentions.morning, mentions.noon, mentions.night].filter(Boolean).length;
  if (count <= 1) {
    if (mentions.night && !mentions.morning) return result(false, false, true);
    if (mentions.noon && !mentions.morning && !mentions.night) return result(false, true, false);
    return result(true, false, false);
  }
  if (count === 2) {
    if (mentioned === 2) return result(mentions.morning, mentions.noon, mentions.night);
    return result(true, false, true);
  }
  return result(true, true, true);
};

/**
 * Parse free dosing text ("1+0+1", "BD", "৩ বেলা", "once at night", "SOS",
 * "1 capsule weekly (every Friday)", ...) into a schedule.
 *
 * Unknown text keeps the historical default: daily, morning only (matched=false).
 */
export const parseDosageSchedule = (dosage: string | null | undefined): ParsedDosage => {
  if (!dosage || typeof dosage !== "string" || !dosage.trim()) {
    return result(false, false, false, "daily", [], false);
  }

  const t = withNumberWords(dosage).trim();
  const mentions = {
    morning: MORNING_RE.test(t),
    noon: NOON_RE.test(t),
    night: NIGHT_RE.test(t),
  };

  // 1. Weekly
  if (WEEKLY_RE.test(t)) {
    const days = parseWeekDays(t);
    const slots = mentions.morning || mentions.noon || mentions.night ? mentions : { morning: true, noon: false, night: false };
    return result(slots.morning, slots.noon, slots.night, "weekly", days);
  }

  // 2. One-time dose (stat, single dose, ১ ডোজ)
  if (ONCE_RE.test(t)) return result(false, false, false, "once");

  // 3. Numeric patterns 1+0+1 / ½+0+½ / 1+1+1+1
  const m = t.match(PATTERN_SEP_RE) || t.match(PATTERN_SPACE_RE);
  if (m) {
    const vals = m.slice(1).filter((v) => v !== undefined).map(doseValue);
    if (vals.length === 4) {
      // morning-noon-evening-night → collapse into the three reminder slots
      return result(vals[0] > 0, vals[1] > 0 || vals[2] > 0, vals[3] > 0 || vals[2] > 0);
    }
    const [a, b, c] = vals;
    if (a > 0 || b > 0 || c > 0) return result(a > 0, b > 0, c > 0);
    return result(false, false, false); // 0+0+0
  }

  // 4. As needed
  if (AS_NEEDED_RE.test(t)) return result(false, false, false, "as_needed");

  // 5. Latin abbreviations
  if (/\b(qds|qid|q\.i\.d|q6h|q\s*6\s*h)\b/.test(t)) return result(true, true, true);
  if (/\b(tds|tid|t\.d\.s|t\.i\.d|q8h|q\s*8\s*h)\b/.test(t)) return result(true, true, true);
  if (/\b(bd|bid|b\.d|b\.i\.d|q12h|q\s*12\s*h)\b/.test(t)) return slotsForCount(2, mentions);
  if (/\b(od|qd|o\.d|q\.d|q24h|daily|once)\b/.test(t) && !/\b(hs|h\.s|qhs|nocte)\b/.test(t)) {
    // "twice daily" etc. are handled below, only treat bare "daily" as once
    const countMatch = t.match(/\b(\d+|two|three|four|twice|thrice)\s*(?:x|times?)?\s*(?:daily|a\s+day|per\s+day|\/\s*day)\b/);
    if (!countMatch && !/\b(twice|thrice)\b/.test(t)) return slotsForCount(1, mentions);
  }
  if (/\b(hs|h\.s|qhs|nocte)\b/.test(t)) return result(false, false, true);

  // 6. "n times daily", "twice", "thrice", "2x"
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, twice: 2, thrice: 3 };
  const times =
    t.match(/\b(\d+|one|two|three|four)\s*(?:x|times?)\s*(?:daily|a\s+day|per\s+day|\/\s*day)?\b/) ||
    t.match(/\b(twice|thrice)\b/);
  if (times) {
    const n = words[times[1]] ?? parseInt(times[1], 10);
    if (n > 0) return slotsForCount(n, mentions);
  }

  // 7. Bangla counts: ৩ বেলা, দিনে ২ বার, ১ বেলা
  const bn = t.match(/(\d+)\s*(?:বেলা|বার)/);
  if (bn) {
    const n = parseInt(bn[1], 10);
    if (n > 0) return slotsForCount(n, mentions);
  }

  // 8. Every N hours
  const hours = t.match(/(?:every|প্রতি)\s*(\d+)\s*(?:hours?|hrs?|h\b|ঘণ্টা|ঘন্টা)|(\d+)\s*(?:ঘণ্টা|ঘন্টা)\s*পর\s*পর/);
  if (hours) {
    const h = parseInt(hours[1] || hours[2], 10);
    if (h >= 24) return slotsForCount(1, mentions);
    if (h >= 12) return result(true, false, true);
    return result(true, true, true);
  }

  // 9. Explicit time mentions (morning / noon / night)
  if (mentions.morning || mentions.noon || mentions.night) {
    return result(mentions.morning, mentions.noon, mentions.night);
  }

  // 10. "before/after meals" without a count — historical behaviour: 3x daily
  if (/\b(before|after)\s+(meals?|food|eating)\b|খাবারের\s*(?:আগে|পরে|পর)/.test(t)) {
    return result(true, true, true);
  }

  // DEFAULT: unknown text — keep the historical morning-only default
  return result(true, false, false, "daily", [], false);
};

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------
const CONTINUE_RE =
  /\b(cont\.?|contd\.?|continue[sd]?|continuing|ongoing|long[\s-]*term|lifelong|life\s*long|to\s+be\s+continued)\b|চলবে|চালিয়ে\s*যা|চালিয়ে|চালু\s*থাকবে|অব্যাহত|নিয়মিত\s*চলবে/;

const UNIT_DAYS: [RegExp, number][] = [
  [/^(d|day|days|দিন)$/, 1],
  [/^(w|wk|wks|week|weeks|সপ্তাহ)$/, 7],
  [/^(mo|mos|mon|month|months|মাস)$/, 30],
  [/^(y|yr|yrs|year|years|বছর)$/, 365],
];

const DURATION_RE =
  /(\d+(?:\.\d+)?)\s*(days?|d|weeks?|wks?|w|months?|mos?|mon|years?|yrs?|দিন|সপ্তাহ|মাস|বছর)(?![a-z])(\s*(?:পর|later|after))?/g;

/**
 * Parse a duration ("৫ দিন", "x 3 mo", "2 weeks", "4 tab x 5 days then 2 tab x 5 days")
 * into days. Returns continueIndefinitely for "continue"/"চলবে"/"cont.".
 */
export const parseDuration = (text: string | null | undefined): ParsedDuration => {
  if (!text || typeof text !== "string") return { days: null, continueIndefinitely: false };
  const t = withNumberWords(text);
  if (CONTINUE_RE.test(t)) return { days: null, continueIndefinitely: true };

  const parts: number[] = [];
  for (const m of t.matchAll(DURATION_RE)) {
    if (m[3]) continue; // "১ মাস পর" = after a month, not a duration
    const unit = UNIT_DAYS.find(([re]) => re.test(m[2]));
    if (unit) parts.push(Math.round(parseFloat(m[1]) * unit[1]));
  }
  if (parts.length === 0) return { days: null, continueIndefinitely: false };
  // Taper: "x 5 days then x 5 days" → total
  const isTaper = parts.length > 1 && /\bthen\b|তারপর|এরপর|তার\s*পর/.test(t);
  const days = isTaper ? parts.reduce((a, b) => a + b, 0) : parts[0];
  return { days: days > 0 ? days : null, continueIndefinitely: false };
};

/** Number of days in a duration string, or null (unknown / continue) */
export const parseDurationDays = (text: string | null | undefined): number | null =>
  parseDuration(text).days;

// ---------------------------------------------------------------------------
// Follow-up ("৭ দিন পর আবার দেখা করবেন", "F/U after 3 months", "Next visit: after 1 month")
// ---------------------------------------------------------------------------
const FOLLOW_UP_KEYWORD_RE =
  /\b(f\/u|follow[\s-]*up|review|next\s+visit|revisit|come\s+again|see\s+me|next\s+appointment)\b|পরবর্তী\s*সাক্ষাৎ|পরবর্তী\s*সাক্ষাত|আবার\s*দেখা|দেখা\s*করবেন|সাক্ষাৎ\s*করবেন|দেখাবেন/;

export const parseFollowUpDays = (text: string | null | undefined): number | null => {
  if (!text) return null;
  const t = withNumberWords(text);
  for (const line of t.split(/\n|।|(?<=\.)\s/)) {
    if (!FOLLOW_UP_KEYWORD_RE.test(line)) continue;
    const m = line.match(/(\d+)\s*(days?|d|weeks?|wks?|w|months?|mos?|mon|years?|yrs?|দিন|সপ্তাহ|মাস|বছর)(?![a-z])/);
    if (m) {
      const unit = UNIT_DAYS.find(([re]) => re.test(m[2]));
      if (unit) return Math.round(parseFloat(m[1]) * unit[1]);
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Medicine form / meal timing
// ---------------------------------------------------------------------------
export type MedicineForm =
  | "tablet"
  | "capsule"
  | "syrup"
  | "drops"
  | "inhaler"
  | "injection"
  | "insulin"
  | "topical"
  | "other";

export const detectForm = (text: string | null | undefined): MedicineForm | null => {
  const t = clean(text || "");
  if (!t.trim()) return null;
  if (/insulin|ইনসুলিন|\bunits?\b|mixtard|novomix|lantus|humulin/.test(t)) return "insulin";
  if (/\b(inh|inhaler|accuhaler|evohaler|rotacap|rotahaler|puffs?|mdi|nebuli[sz]er|neb)\b|ইনহেলার/.test(t)) return "inhaler";
  if (/\b(inj|injection|vial|amp|ampoule|im|iv|sc)\b|ইনজেকশন|ইঞ্জেকশন/.test(t)) return "injection";
  if (/\b(drops?|e\/d|ear\s*drop|eye\s*drop|nasal\s*drop)\b|ড্রপ|ফোঁটা/.test(t)) return "drops";
  if (/\b(syp|syr|syrup|susp|suspension|elixir|tsf|tsp)\b|সিরাপ|চামচ|সাসপেনশন/.test(t)) return "syrup";
  if (/\b(cap|caps|capsule|capsules)\b|ক্যাপসুল|ক্যাপ/.test(t)) return "capsule";
  if (/\b(tab|tabs|tablet|tablets)\b|ট্যাবলেট|ট্যাব/.test(t)) return "tablet";
  if (/\b(cream|oint|ointment|gel|lotion|paint|spray|patch)\b|মলম|ক্রিম/.test(t)) return "topical";
  return null;
};

export type MealTiming = "before_meal" | "after_meal" | "with_meal" | "empty_stomach";

export const detectMealTiming = (text: string | null | undefined): MealTiming | null => {
  const t = clean(text || "");
  if (/empty\s+stomach|খালি\s*পেটে/.test(t)) return "empty_stomach";
  if (/\b(with\s+(?:meals?|food)|during\s+meals?)\b|খাবারের\s*সাথে|খাবারের\s*সঙ্গে/.test(t)) return "with_meal";
  if (/\b(before\s+(?:meals?|food|breakfast|lunch|dinner|eating)|a\.?c\.?)\b|খাবারের\s*আগে|খাওয়ার\s*আগে|খাবার\s*আগে/.test(t)) return "before_meal";
  if (/\b(after\s+(?:meals?|food|breakfast|lunch|dinner|eating)|p\.?c\.?)\b|খাবারের\s*পরে|খাবারের\s*পর|খাওয়ার\s*পরে|খাওয়ার\s*পর|ভরা\s*পেটে/.test(t)) return "after_meal";
  return null;
};
