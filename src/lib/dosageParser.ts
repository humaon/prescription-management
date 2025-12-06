// src/lib/dosageParser.ts

export interface ParsedDosage {
    morning: boolean;
    noon: boolean;
    night: boolean;
    totalDoses: number;
  }
  
  /**
   * Parse dosage string to schedule
   * Formats supported:
   * - "1-0-1" (morning-noon-night)
   * - "1-1-1"
   * - "0-1-0"
   * - "morning" or "Morning"
   * - "morning, night"
   * - "2 times daily"
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
  
    const cleanDosage = dosage.toLowerCase().trim();
  
    // Pattern 1: "1-0-1" format
    const dashPattern = /^(\d+)-(\d+)-(\d+)$/;
    const dashMatch = cleanDosage.match(dashPattern);
    if (dashMatch) {
      const morning = parseInt(dashMatch[1]) > 0;
      const noon = parseInt(dashMatch[2]) > 0;
      const night = parseInt(dashMatch[3]) > 0;
      return {
        morning,
        noon,
        night,
        totalDoses: (morning ? 1 : 0) + (noon ? 1 : 0) + (night ? 1 : 0),
      };
    }
  
    // Pattern 2: "morning", "noon", "night", "evening"
    const hasMorning = /morning|breakfast/i.test(cleanDosage);
    const hasNoon = /noon|afternoon|lunch/i.test(cleanDosage);
    const hasNight = /night|evening|dinner|bedtime/i.test(cleanDosage);
  
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
    const timesMatch = cleanDosage.match(timesPattern);
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
    if (/twice|2x/i.test(cleanDosage)) {
      return { morning: true, noon: false, night: true, totalDoses: 2 };
    }
  
    // Default: if nothing matches, assume morning only
    return { morning: true, noon: false, night: false, totalDoses: 1 };
  };