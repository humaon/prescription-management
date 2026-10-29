// Vitals as written on the prescription, plus numbers parsed from them for trends.
// The AI only copies the text; every number here comes from these rules.

export const VITAL_KEYS = ["bp", "pulse", "temperature", "weight", "spo2", "bloodSugar"] as const;
export type VitalKey = (typeof VITAL_KEYS)[number];

export interface VitalValues {
  systolic: number | null;
  diastolic: number | null;
  pulseBpm: number | null;
  temperatureF: number | null;
  weightKg: number | null;
  spo2Pct: number | null;
  bloodSugarMmol: number | null;
}

export type IVitals = Record<VitalKey, string | null> & { values?: VitalValues };

const asciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));

const firstNumber = (s: string): number | null => {
  const m = /(\d+(?:\.\d+)?)/.exec(s);
  return m ? parseFloat(m[1]) : null;
};

const inRange = (n: number | null, min: number, max: number) =>
  n !== null && n >= min && n <= max ? n : null;

const round1 = (n: number) => Math.round(n * 10) / 10;

export const parseVitalValues = (v: Partial<Record<VitalKey, string | null>>): VitalValues => {
  const text = (k: VitalKey) => asciiDigits(String(v[k] ?? "")).toLowerCase();

  let systolic: number | null = null;
  let diastolic: number | null = null;
  const bp = /(\d{2,3})\s*\/\s*(\d{2,3})/.exec(text("bp"));
  if (bp) {
    const s = inRange(parseInt(bp[1], 10), 60, 260);
    const d = inRange(parseInt(bp[2], 10), 30, 160);
    if (s !== null && d !== null && s > d) {
      systolic = s;
      diastolic = d;
    }
  }

  const pulseBpm = inRange(firstNumber(text("pulse")), 30, 220);

  let temperatureF: number | null = null;
  const t = firstNumber(text("temperature"));
  if (t !== null) {
    if (t >= 34 && t <= 43) temperatureF = round1((t * 9) / 5 + 32);
    else temperatureF = inRange(t, 90, 110);
  }

  let weightKg: number | null = null;
  const w = firstNumber(text("weight"));
  if (w !== null) {
    weightKg = inRange(/lb|pound/.test(text("weight")) ? round1(w * 0.4536) : w, 1, 300);
  }

  // Drop the "SpO2" label first, or its "2" would be read as the value
  const spo2Pct = inRange(firstNumber(text("spo2").replace(/s\s*p\s*o\s*2|o2/g, "")), 50, 100);

  let bloodSugarMmol: number | null = null;
  const g = firstNumber(text("bloodSugar"));
  if (g !== null) {
    const mgdl = /mg/.test(text("bloodSugar")) || g > 35;
    bloodSugarMmol = inRange(mgdl ? round1(g / 18) : g, 1, 60);
  }

  return { systolic, diastolic, pulseBpm, temperatureF, weightKg, spo2Pct, bloodSugarMmol };
};

/** Coerces client / AI vitals; null when nothing was written */
export const normalizeVitals = (raw: any): IVitals | null => {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as Record<VitalKey, string | null>;
  for (const k of VITAL_KEYS) {
    const s = raw[k] === null || raw[k] === undefined ? "" : String(raw[k]).trim();
    out[k] = s && s.toLowerCase() !== "null" ? s.slice(0, 60) : null;
  }
  if (VITAL_KEYS.every((k) => out[k] === null)) return null;
  return { ...out, values: parseVitalValues(out) };
};
