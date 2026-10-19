// Allergy lists and matching medicines against them.

/** Trimmed, de-duplicated (case-insensitive) allergy strings */
export const cleanAllergies = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const s = typeof v === "string" ? v.trim().slice(0, 80) : "";
    if (!s || s.toLowerCase() === "null" || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out.slice(0, 30);
};

export const mergeAllergies = (a: string[], b: string[]) => cleanAllergies([...a, ...b]);

// Well-known drug classes, so "penicillin allergy" also flags amoxicillin
const CLASS_MEMBERS: Record<string, string[]> = {
  penicillin: ["amoxicillin", "ampicillin", "flucloxacillin", "cloxacillin", "phenoxymethylpenicillin", "benzylpenicillin", "piperacillin"],
  nsaid: ["ibuprofen", "diclofenac", "naproxen", "aceclofenac", "ketorolac", "mefenamic", "aspirin", "etoricoxib", "celecoxib", "indomethacin", "ketoprofen"],
  sulfa: ["sulfamethoxazole", "cotrimoxazole", "co-trimoxazole", "sulfasalazine", "sulfadiazine"],
  sulpha: ["sulfamethoxazole", "cotrimoxazole", "co-trimoxazole", "sulfasalazine", "sulfadiazine"],
  cephalosporin: ["cefixime", "cefuroxime", "ceftriaxone", "cephalexin", "cefpodoxime", "cefradine", "cefadroxil"],
  quinolone: ["ciprofloxacin", "levofloxacin", "moxifloxacin", "ofloxacin", "norfloxacin"],
  macrolide: ["azithromycin", "clarithromycin", "erythromycin"],
};

const STOP = new Set(["allergy", "allergic", "allergies", "drug", "drugs", "history", "known", "with", "from"]);

/** Lower-case English words of an allergy entry worth matching */
const allergyTerms = (allergy: string) =>
  allergy
    .toLowerCase()
    .replace(/h\/o/g, " ")
    .split(/[^a-z-]+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
    .map((w) => w.replace(/s$/, ""));

/**
 * The allergy a medicine may clash with, or null. Matches the generic name /
 * brand name against the allergy words and the class members above.
 */
export const allergyClash = (
  med: { name: string; genericName?: string | null },
  allergies: string[]
): string | null => {
  const haystack = `${med.genericName ?? ""} ${med.name}`.toLowerCase();
  for (const allergy of allergies) {
    for (const term of allergyTerms(allergy)) {
      if (haystack.includes(term)) return allergy;
      const members = CLASS_MEMBERS[term] ?? [];
      if (members.some((m) => haystack.includes(m))) return allergy;
    }
  }
  return null;
};
