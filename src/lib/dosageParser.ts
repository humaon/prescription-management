// src/lib/dosageParser.ts

export interface ParsedDosage {
  morning: boolean;
  noon: boolean;
  night: boolean;
  totalDoses: number;
}

/**
 * Bangla to English digit mapping
 */
const banglaToEnglishDigit: { [key: string]: string } = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
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
 * 
 * Supported formats:
 * 
 * Number patterns:
 * - "1-0-1", "1+0+1", "1 0 1" (morning-noon-night)
 * - "২-০-১" (Bangla digits)
 * - "2-1-2" (multiple pills per time)
 * 
 * Text patterns:
 * - "once daily", "once a day", "one time daily"
 * - "twice daily", "twice a day", "two times daily"
 * - "three times daily", "thrice daily"
 * - "once", "twice", "thrice"
 * - "2x", "3x"
 * 
 * Time mentions:
 * - "morning", "breakfast"
 * - "noon", "afternoon", "lunch"
 * - "night", "evening", "dinner", "bedtime"
 * 
 * Frequency patterns:
 * - "every 12 hours" → twice daily
 * - "every 8 hours" → three times daily
 * - "every 6 hours" → three times daily
 */
export const parseDosageSchedule = (dosage: string): ParsedDosage => {
  const defaultSchedule: ParsedDosage = {
    morning: false,
    noon: false,
    night: false,
    totalDoses: 0,
  };

  if (!dosage || typeof dosage !== "string") {
    return defaultSchedule;
  }

  // Convert Bangla digits to English
  let cleanDosage = convertBanglaDigitsToEnglish(dosage);
  cleanDosage = cleanDosage.trim();

  console.log(`[DosageParser] Original: "${dosage}" -> Cleaned: "${cleanDosage}"`);

  // ========================================
  // PATTERN 1: Number patterns (1-0-1, 1+0+1, 1 0 1)
  // ========================================
  const numberPattern = /([0-3])[\s\-\+]*([0-3])[\s\-\+]*([0-3])/;
  const numberMatch = cleanDosage.match(numberPattern);
  
  if (numberMatch) {
    const morningCount = parseInt(numberMatch[1]);
    const noonCount = parseInt(numberMatch[2]);
    const nightCount = parseInt(numberMatch[3]);
    
    console.log(`[DosageParser] Matched number pattern: ${morningCount}-${noonCount}-${nightCount}`);
    
    return {
      morning: morningCount > 0,
      noon: noonCount > 0,
      night: nightCount > 0,
      totalDoses: morningCount + noonCount + nightCount,
    };
  }

  const cleanLower = cleanDosage.toLowerCase();

  // ========================================
  // PATTERN 2: "once daily", "twice daily", "thrice daily"
  // ========================================
  
  // Once daily
  if (/\b(once|one time)\b.*\b(daily|a day|per day)\b/i.test(cleanLower)) {
    console.log(`[DosageParser] Matched: once daily`);
    return { morning: true, noon: false, night: false, totalDoses: 1 };
  }

  // Twice daily
  if (/\b(twice|two times?|2\s*times?)\b.*\b(daily|a day|per day)\b/i.test(cleanLower)) {
    console.log(`[DosageParser] Matched: twice daily`);
    return { morning: true, noon: false, night: true, totalDoses: 2 };
  }

  // Thrice daily / three times daily
  if (/\b(thrice|three times?|3\s*times?)\b.*\b(daily|a day|per day)\b/i.test(cleanLower)) {
    console.log(`[DosageParser] Matched: three times daily`);
    return { morning: true, noon: true, night: true, totalDoses: 3 };
  }

  // Four times daily
  if (/\b(four times?|4\s*times?)\b.*\b(daily|a day|per day)\b/i.test(cleanLower)) {
    console.log(`[DosageParser] Matched: four times daily`);
    return { morning: true, noon: true, night: true, totalDoses: 3 };
  }

  // ========================================
  // PATTERN 3: "X times daily" (generic)
  // ========================================
  const timesPattern = /(\d+)\s*times?\s*(daily|a day|per day)/i;
  const timesMatch = cleanLower.match(timesPattern);
  if (timesMatch) {
    const times = parseInt(timesMatch[1]);
    console.log(`[DosageParser] Matched times pattern: ${times} times daily`);
    
    if (times === 1) {
      return { morning: true, noon: false, night: false, totalDoses: 1 };
    } else if (times === 2) {
      return { morning: true, noon: false, night: true, totalDoses: 2 };
    } else if (times >= 3) {
      return { morning: true, noon: true, night: true, totalDoses: 3 };
    }
  }

  // ========================================
  // PATTERN 4: Just "once", "twice", "thrice" (without "daily")
  // ========================================
  
  if (/\b(once|one time)\b/i.test(cleanLower) && !/daily/i.test(cleanLower)) {
    console.log(`[DosageParser] Matched: once`);
    return { morning: true, noon: false, night: false, totalDoses: 1 };
  }

  if (/\b(twice|2x|two times?)\b/i.test(cleanLower)) {
    console.log(`[DosageParser] Matched: twice`);
    return { morning: true, noon: false, night: true, totalDoses: 2 };
  }

  if (/\b(thrice|3x|three times?)\b/i.test(cleanLower)) {
    console.log(`[DosageParser] Matched: thrice`);
    return { morning: true, noon: true, night: true, totalDoses: 3 };
  }

  // ========================================
  // PATTERN 5: Specific time mentions
  // ========================================
  const hasMorning = /\b(morning|breakfast)\b/i.test(cleanLower);
  const hasNoon = /\b(noon|afternoon|lunch)\b/i.test(cleanLower);
  const hasNight = /\b(night|evening|dinner|bedtime)\b/i.test(cleanLower);

  if (hasMorning || hasNoon || hasNight) {
    console.log(`[DosageParser] Matched time mentions: morning=${hasMorning}, noon=${hasNoon}, night=${hasNight}`);
    const total = (hasMorning ? 1 : 0) + (hasNoon ? 1 : 0) + (hasNight ? 1 : 0);
    return {
      morning: hasMorning,
      noon: hasNoon,
      night: hasNight,
      totalDoses: total,
    };
  }

  // ========================================
  // PATTERN 6: "every X hours"
  // ========================================
  const hoursPattern = /every\s*(\d+)\s*hours?/i;
  const hoursMatch = cleanLower.match(hoursPattern);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1]);
    console.log(`[DosageParser] Matched: every ${hours} hours`);
    
    if (hours >= 24) {
      // Once a day
      return { morning: true, noon: false, night: false, totalDoses: 1 };
    } else if (hours >= 12) {
      // Twice a day (every 12 hours)
      return { morning: true, noon: false, night: true, totalDoses: 2 };
    } else if (hours >= 6) {
      // Three times a day (every 6-8 hours)
      return { morning: true, noon: true, night: true, totalDoses: 3 };
    } else {
      // More frequently (assume 3 times for simplicity)
      return { morning: true, noon: true, night: true, totalDoses: 3 };
    }
  }

  // ========================================
  // PATTERN 7: "before/after meals"
  // ========================================
  if (/\b(before|after)\s+(meals?|food|eating)\b/i.test(cleanLower)) {
    console.log(`[DosageParser] Matched: before/after meals (assume 3x daily)`);
    return { morning: true, noon: true, night: true, totalDoses: 3 };
  }

  // ========================================
  // PATTERN 8: All zeros (0-0-0 or 0+0+0)
  // ========================================
  if (/^0[\s\-\+]*0[\s\-\+]*0$/.test(cleanDosage)) {
    console.log(`[DosageParser] All zeros detected, returning empty schedule`);
    return defaultSchedule;
  }

  // ========================================
  // DEFAULT: If nothing matches AND dosage has content
  // ========================================
  console.warn(`[DosageParser] No pattern matched for: "${dosage}", using default (morning only)`);
  return { morning: true, noon: false, night: false, totalDoses: 1 };
};