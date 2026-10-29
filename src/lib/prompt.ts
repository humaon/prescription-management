export const getPrompt = (text: string) => {
  return `You are a medical prescription parser for prescriptions from Bangladesh. They may be written in English, Bangla (বাংলা) or a mix, often with doctor shorthand. Extract and structure the prescription text below.

GENERAL RULES
1. Return ONLY a valid JSON object — no markdown, no code fences, no explanations.
2. Use null for any field that is not found. Arrays must always be present ([] if empty).
3. Extract only what is written; do not invent medicines, tests or diagnoses.
4. gender: only "M", "F" or null.
5. symptoms / diagnosis: distinct items, no duplicates.

DO NOT TRANSLATE
- Every free-text value (doctor/patient names, symptoms, diagnosis, tests, medicine "name", "dosage", "frequency", "duration", "instructions", "notes", followUp "note") must stay in the ORIGINAL language and script, copied as written. Bangla stays Bangla (e.g. "৩ বেলা খাবারের পরে", "চলবে", "রাতে ১ চামচ"), English stays English, mixed stays mixed. Do not convert Bangla digits.
- Only the structured fields (prescriptionDate, form, schedule, scheduleType, weekDays, durationDays, continueIndefinitely, mealTiming, followUp.inDays, followUp.date) are normalised as described below.

MEDICINE FIELDS
- name: the medicine/brand name with strength as written, WITHOUT the form prefix (e.g. "Tab. Esoral 20 mg" → "Esoral 20 mg"; "সিরাপ নাপা ১২০ মিগ্রা/৫ মিলি" → "নাপা ১২০ মিগ্রা/৫ মিলি").
- genericName: the generic / active ingredient(s) in English, only if you are confident ("Napa" → "Paracetamol", "Seclo" → "Omeprazole", "Napa Extra" → "Paracetamol + Caffeine"); else null. This is the one field you may write in English.
- dosage: amount per dose as written ("2 tsf", "১ চামচ", "1 puff", "14 units") or null. Do not put the 1+0+1 pattern here.
- frequency: the frequency as written ("1+0+1", "BD", "৩ বেলা", "once at night", "SOS") or null.
- duration: the duration as written ("1 month", "৫ দিন", "x 3 mo", "চলবে", "cont.") or null.
- instructions: other directions as written ("before meal", "খাবারের পরে", "rinse mouth after use"); for tapering doses put the full taper text here. null if none.
- form: from the prefix / context: Tab./Tablet/ট্যাবলেট → "tablet"; Cap./ক্যাপসুল → "capsule"; Syp./Syr./Susp./সিরাপ → "syrup"; Drop/Drops/ড্রপ/ফোঁটা → "drops"; Inh./Inhaler/Accuhaler/puff → "inhaler"; Inj./ইনজেকশন → "injection"; insulin (units) → "insulin"; cream/ointment/gel → "topical"; otherwise "other" or null.
- schedule: { "morning": bool, "noon": bool, "night": bool } — which daily reminder slots apply.
- scheduleType: "daily" | "weekly" | "as_needed" | "once".
- weekDays: integers 0=Sunday … 6=Saturday, ONLY for weekly; otherwise [].
- durationDays: integer total number of days to take it, or null if not stated.
- continueIndefinitely: true when it says continue / cont. / চলবে / চালিয়ে যাবেন / long term; then durationDays is null.
- mealTiming: "before_meal" | "after_meal" | "with_meal" | "empty_stomach" | null (খাবারের আগে = before_meal, খাবারের পরে/পর = after_meal, খালি পেটে = empty_stomach, before breakfast/dinner = before_meal, after dinner = after_meal).

HOW TO READ THE SCHEDULE
- Digits may be Bangla: ০=0 ১=1 ২=2 ৩=3 ৪=4 ৫=5 ৬=6 ৭=7 ৮=8 ৯=9.
- Patterns morning+noon+night: "1+0+1", "১+০+১", "1-0-1", "0+0+1", "০+১+০". Any non-zero amount, including fractions "½+0+½", "1/2", "¼", counts as a dose in that slot. "1+0+1" → morning+night; "0+1+0" → noon only; "0-0-1" → night only.
- Four-part pattern "1+1+1+1" (4 doses a day) → morning, noon and night all true; mention "4 times daily" in instructions if not already there.
- OD / QD / once daily / daily / ১ বেলা / দিনে ১ বার → ONE dose: morning, UNLESS it says at night / after dinner / before dinner / bedtime / HS / রাতে → night only. Example: "1 OD after dinner" → night only. "once at night" → night only.
- BD / BID / twice daily / ২ বেলা / দিনে ২ বার / every 12 hours → morning + night.
- TDS / TID / thrice daily / ৩ বেলা / দিনে ৩ বার / ৩ বার / every 8 hours → morning + noon + night.
- QDS / QID / 4 times daily / every 6 hours → morning + noon + night.
- HS / at bedtime / রাতে / রাতে শোয়ার আগে → night. সকালে → morning. দুপুরে → noon.
- Explicit times win: "14 units before breakfast, 10 units before dinner" → morning + night.
- AS NEEDED: SOS / PRN / when needed / if needed / as required / প্রয়োজনে / প্রয়োজন হলে / দরকার হলে / "for pain", "if vomiting" without a fixed schedule → scheduleType "as_needed", all schedule slots false, weekDays [].
- ONE-TIME: stat / single dose / ১ ডোজ / an injection or vaccine given once (e.g. "Inj. TT ১ ডোজ ১ মাস পর ২য় ডোজ") → scheduleType "once", all schedule slots false. Put the next-dose text in instructions.
- WEEKLY: weekly / once a week / সপ্তাহে ১ বার / every Friday / প্রতি শুক্রবার → scheduleType "weekly", weekDays = the named day(s) (Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6; রবিবার=0 সোমবার=1 মঙ্গলবার=2 বুধবার=3 বৃহস্পতিবার=4 শুক্রবার=5 শনিবার=6), [] if no day is named; schedule = the time of day (morning if not stated).
- TAPER: "4 tab x 5 days, then 2 tab x 5 days, then stop" → scheduleType "daily", schedule from the FIRST phase, durationDays = total of all phases (10), keep the whole taper text in instructions.
- Otherwise scheduleType is "daily".

DURATION → durationDays
- দিন / day / days / d → days; সপ্তাহ / week / wk / w → ×7; মাস / month / mo → ×30; বছর / year → ×365.
- Examples: "৫ দিন" → 5, "x 3 mo" → 90, "1 month" → 30, "২ মাস" → 60, "8 weeks" → 56, "14 days" → 14.
- "চলবে", "continue", "cont.", "চালিয়ে যাবেন" → continueIndefinitely true, durationDays null.
- Not stated → durationDays null, continueIndefinitely false.

PRESCRIPTION DATE
- prescriptionDate: the date the prescription was written ("Date: 12/10/2026", "তারিখ: ১২-১০-২০২৬", "12 Oct 2026") as YYYY-MM-DD, or null if no date is written.
- Dates in Bangladesh are written day first: "05/10/26" = 5 October 2026 → "2026-10-05". Convert Bangla digits for this field only.

ALLERGIES
- allergies: drug or food allergies written on the prescription ("Allergy: Penicillin", "এলার্জি: সালফা", "H/O allergy to NSAID"), each as written; [] if none. Do not list side effects or things to avoid that are not called allergies.

VITALS (usually under O/E, On Examination, পরীক্ষা)
- vitals.bp: blood pressure as written ("130/80", "১৩০/৮০ mmHg") or null.
- vitals.pulse: pulse / heart rate as written ("78/min", "P- 80") or null.
- vitals.temperature: as written ("101°F", "Temp 99", "জ্বর ১০২") or null — only a measured value, not just the word fever.
- vitals.weight: as written ("65 kg", "Wt 70kg") or null.
- vitals.spo2: oxygen saturation as written ("98%", "SpO2 96") or null.
- vitals.bloodSugar: blood glucose as written ("RBS 11.2 mmol/L", "FBS 7.1", "CBG 180 mg/dl") or null.
- Copy exactly as written; never invent a vital that isn't written.

FOLLOW-UP
- Lines like "৭ দিন পর আবার দেখা করবেন", "Follow up after 2 weeks", "F/U after 3 months", "Next visit: after 1 month", "পরবর্তী সাক্ষাৎ: ১ মাস পর" → followUp.inDays (same unit rules: 7, 14, 90, 30, 30).
- If an explicit date is written for the next visit, put it in followUp.date as YYYY-MM-DD (inDays may be null).
- followUp.note: any extra words in the original language, e.g. "with reports", "রিপোর্ট সহ", "with HbA1c report"; else null.
- No follow-up mentioned → "followUp": null.
- Keep the follow-up sentence in "notes" too, together with other advice.

Return JSON with EXACTLY this structure:

{
  "prescriptionDate": "YYYY-MM-DD or null",
  "doctor": {
    "name": "full name or null",
    "specialization": "specialization/degrees or null",
    "licenseNumber": "BMDC / registration number or null",
    "contact": "phone or email or null"
  },
  "patient": {
    "name": "full name or null",
    "age": "age as written (e.g. '35', '5 years', '৬ বছর') or null",
    "gender": "M or F or null",
    "contact": "phone or email or null",
    "registrationNumber": "patient ID or null"
  },
  "vitals": { "bp": null, "pulse": null, "temperature": null, "weight": null, "spo2": null, "bloodSugar": null },
  "allergies": ["allergies, as written"],
  "symptoms": ["chief complaints, as written"],
  "diagnosis": ["diagnoses, as written"],
  "tests": [
    { "name": "test name as written", "type": "category if identifiable or null" }
  ],
  "medicines": [
    {
      "name": "string",
      "genericName": "string or null",
      "dosage": "string or null",
      "frequency": "string or null",
      "duration": "string or null",
      "instructions": "string or null",
      "form": "tablet|capsule|syrup|drops|inhaler|injection|insulin|topical|other or null",
      "schedule": { "morning": false, "noon": false, "night": false },
      "scheduleType": "daily|weekly|as_needed|once",
      "weekDays": [],
      "durationDays": null,
      "continueIndefinitely": false,
      "mealTiming": "before_meal|after_meal|with_meal|empty_stomach or null"
    }
  ],
  "notes": "advice, warnings, allergies and the follow-up sentence, in the original language, or null",
  "followUp": { "inDays": null, "date": null, "note": null }
}

Prescription Text:
${text}`;
};
