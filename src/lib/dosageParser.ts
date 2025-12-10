// src/lib/dosageParser.ts

export interface ParsedDosage {
  morning: boolean;
  noon: boolean;
  night: boolean;
  totalDoses: number;
}

/**
 * Bangla to English digit mapping (only 0 and 1)
 */
const banglaToEnglishDigit: { [key: string]: string } = {
  '০': '0',
  '১': '1',
};

/**
 * Convert Bangla digits to English digits
 */
const convertBanglaDigitsToEnglish = (text: string): string => {
  let result = text;
  Object.entries(banglaToEnglishDigit).forEach(([bangla, english]) => {
    result = result.replace(new RegExp(bangla, 'g'), english);
  });
  return result;
};

/**
 * Parse dosage string to schedule
 * Formats supported:
 * - "1-0-1" or "1+0+1" (morning-noon-night)
 * - "০+১+০" (Bangla digits)
 * - "1 0 1" (space separated)
 */
export const parseDosageSchedule = (dosage: string): ParsedDosage => {
  const defaultSchedule = {
    morning: false,
    noon: false,
    night: false,
    totalDoses: 0,
  };

  if (!dosage || typeof dosage !== "string") {
    return defaultSchedule;
  }

  // Convert Bangla digits to English (০১ -> 01)
  let cleanDosage = convertBanglaDigitsToEnglish(dosage);
  cleanDosage = cleanDosage.trim();

  // Pattern: "1-0-1" or "1+0+1" or "1 0 1" format
  const numberPattern = /^([01])[\s\-\+]+([01])[\s\-\+]+([01])$/;
  const numberMatch = cleanDosage.match(numberPattern);
  
  if (numberMatch) {
    const morningCount = parseInt(numberMatch[1]);
    const noonCount = parseInt(numberMatch[2]);
    const nightCount = parseInt(numberMatch[3]);
    
    return {
      morning: morningCount === 1,
      noon: noonCount === 1,
      night: nightCount === 1,
      totalDoses: morningCount + noonCount + nightCount,
    };
  }

  // Pattern 2: "morning", "noon", "night", "evening"
  const cleanLower = cleanDosage.toLowerCase();
  const hasMorning = /morning|breakfast/i.test(cleanLower);
  const hasNoon = /noon|afternoon|lunch/i.test(cleanLower);
  const hasNight = /night|evening|dinner|bedtime/i.test(cleanLower);

  if (hasMorning || hasNoon || hasNight) {
    return {
      morning: hasMorning,
      noon: hasNoon,
      night: hasNight,
      totalDoses: (hasMorning ? 1 : 0) + (hasNoon ? 1 : 0) + (hasNight ? 1 : 0),
    };
  }

  // Pattern 3: "3 times daily", "twice daily"
  const timesPattern = /(\d+)\s*times?\s*(daily|a day|per day)/i;
  const timesMatch = cleanLower.match(timesPattern);
  if (timesMatch) {
    const times = parseInt(timesMatch[1]);
    if (times === 1) {
      return { morning: true, noon: false, night: false, totalDoses: 1 };
    } else if (times === 2) {
      return { morning: true, noon: false, night: true, totalDoses: 2 };
    } else if (times >= 3) {
      return { morning: true, noon: true, night: true, totalDoses: 3 };
    }
  }

  // Pattern 4: "twice" or "2x"
  if (/twice|2x/i.test(cleanLower)) {
    return { morning: true, noon: false, night: true, totalDoses: 2 };
  }

  // Default: if nothing matches, assume morning only
  return { morning: true, noon: false, night: false, totalDoses: 1 };
};