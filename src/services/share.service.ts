// Doctor share links: create / list / revoke, and the public one-page summary.
import crypto from "crypto";
import { Types } from "mongoose";
import { ShareLinkModel } from "../models/shareLink.model";
import { PrescriptionModel } from "../models/prescription.model";
import { User } from "../models/user.model";
import { createServiceError } from "../lib/utils";
import { mergeAllergies } from "../lib/allergies";
import { normalizeMedicine } from "../validation/prescription.validation";
import { addDaysYmd, ymdInAppTz } from "../lib/appDate";
import { getAdherenceService } from "./prescription.service";
import { runWithProfile } from "../lib/requestScope";

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const createShareLinkService = async (
  userId: string,
  profileId: Types.ObjectId | null,
  days: number
) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 86400000);
  const link = await ShareLinkModel.create({
    tokenHash: hash(token),
    userId: new Types.ObjectId(userId),
    profileId,
    expiresAt,
  });
  return { id: link._id, token, expiresAt };
};

export const listShareLinksService = async (userId: string, profileId: Types.ObjectId | null) =>
  ShareLinkModel.find({
    userId: new Types.ObjectId(userId),
    profileId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select("expiresAt viewCount lastViewedAt createdAt")
    .sort({ createdAt: -1 })
    .lean();

export const revokeShareLinkService = async (userId: string, id: string) => {
  const res = await ShareLinkModel.updateOne(
    { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), revokedAt: null },
    { revokedAt: new Date() }
  );
  if (!res.matchedCount) throw createServiceError("Share link not found", 404);
};

// ---------- Public page ----------
const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmtDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
:root{--ink:#14213d;--muted:#5b6475;--line:#e3e7ef;--bg:#f6f8fb;--card:#fff;--warn:#b42318;--accent:#2563eb}
@media (prefers-color-scheme: dark){:root{--ink:#e8ecf4;--muted:#a3abbb;--line:#2a3142;--bg:#11151d;--card:#1a1f2b;--warn:#ff8a7a;--accent:#7aa2ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI","Noto Sans Bengali",sans-serif}
main{max-width:860px;margin:0 auto;padding:20px 16px 40px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 10px}
.muted{color:var(--muted)}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:14px}
.warn{color:var(--warn);font-weight:600}table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:7px 6px;border-top:1px solid var(--line);vertical-align:top}th{font-weight:600;color:var(--muted);font-size:13px;border-top:0}
.tag{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:999px;border:1px solid currentColor}
.wrap{overflow-x:auto}footer{margin-top:20px;font-size:12px}
</style></head><body><main>${body}</main></body></html>`;

export const expiredPage = () =>
  page(
    "Link unavailable",
    `<h1>This link is no longer available</h1><p class="muted">It has expired or the patient stopped sharing it. Ask the patient for a new link.</p>`
  );

/** The doctor-facing summary for a share token, or null if it doesn't work */
export const renderSharedSummary = async (token: string): Promise<string | null> => {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const link = await ShareLinkModel.findOneAndUpdate(
    { tokenHash: hash(token), revokedAt: null, expiresAt: { $gt: new Date() } },
    { $inc: { viewCount: 1 }, lastViewedAt: new Date() },
    { new: true }
  ).lean();
  if (!link) return null;

  const owner = { userId: link.userId, profileId: link.profileId ?? null };
  const [prescriptions, user] = await Promise.all([
    PrescriptionModel.find({ ...owner, status: "confirmed" }).sort({ uploadedAt: -1 }).limit(50).lean(),
    User.findById(link.userId).select("fullName allergies profiles").lean(),
  ]);
  const profile = link.profileId ? user?.profiles?.find((p) => p._id.equals(link.profileId!)) : null;
  const latest = prescriptions[0];
  const name = latest?.patient?.name || profile?.name || user?.fullName || "Patient";
  const allergies = mergeAllergies(
    (profile ? profile.allergies : user?.allergies) ?? [],
    prescriptions.flatMap((p) => p.allergies ?? [])
  );

  const dateOf = (p: any) => p.prescriptionDate || ymdInAppTz(new Date(p.uploadedAt));
  const today = ymdInAppTz();

  // Medicines still running on current prescriptions
  const current = prescriptions.filter((p) => p.isCurrent && !p.isComplete);
  const meds = current.flatMap((p) =>
    p.medicines
      .map((m) => normalizeMedicine(m))
      .filter((m) => m.continueIndefinitely || !m.durationDays || addDaysYmd(dateOf(p), m.durationDays - 1) >= today)
      .map((m) => ({ m, p }))
  );

  const diagnoses = [...new Set(prescriptions.slice(0, 10).flatMap((p) => p.diagnosis ?? []))].slice(0, 12);

  const vitals = prescriptions
    .filter((p) => p.vitals)
    .slice(0, 6)
    .map((p) => ({ date: dateOf(p), v: p.vitals as any }));

  const tests = prescriptions
    .flatMap((p) => p.tests.filter((t: any) => t.status === "completed").map((t: any) => ({ t, p })))
    .sort((a, b) => new Date(b.t.completedDate ?? 0).getTime() - new Date(a.t.completedDate ?? 0).getTime())
    .slice(0, 8);
  const pending = [
    ...new Set(prescriptions.flatMap((p) => p.tests.filter((t: any) => t.status === "pending").map((t: any) => t.name))),
  ];

  const adherence = await runWithProfile(owner.profileId, () => getAdherenceService(link.userId.toString(), 30));

  const section = (title: string, inner: string) => `<section class="card"><h2>${esc(title)}</h2>${inner}</section>`;
  const none = (text: string) => `<p class="muted">${esc(text)}</p>`;

  const body = [
    `<h1>${esc(name)}</h1>`,
    `<p class="muted">${[latest?.patient?.age && `Age ${esc(latest.patient.age)}`, latest?.patient?.gender === "M" ? "Male" : latest?.patient?.gender === "F" ? "Female" : null]
      .filter(Boolean)
      .join(" · ")}${latest ? ` · Last prescription ${esc(fmtDate(dateOf(latest)))}` : ""}</p>`,
    section(
      "Allergies",
      allergies.length ? `<p class="warn">⚠ ${allergies.map(esc).join(", ")}</p>` : none("None recorded")
    ),
    section(
      "Current medicines",
      meds.length
        ? `<div class="wrap"><table><thead><tr><th>Medicine</th><th>Dose</th><th>How often</th><th>Since</th><th>Prescribed by</th></tr></thead><tbody>${meds
            .map(
              ({ m, p }) =>
                `<tr><td><strong>${esc(m.name)}</strong>${m.genericName ? `<br><span class="muted">${esc(m.genericName)}</span>` : ""}</td><td>${esc(m.dosage ?? "")}</td><td>${esc(
                  m.frequency ?? ""
                )}${m.continueIndefinitely ? " · ongoing" : m.durationDays ? ` · ${m.durationDays} days` : ""}</td><td>${esc(fmtDate(dateOf(p)))}</td><td>${esc(p.doctor?.name ?? "")}</td></tr>`
            )
            .join("")}</tbody></table></div>`
        : none("No current medicines")
    ),
    adherence.percent !== null
      ? section(
          "Medicine adherence (last 30 days)",
          `<p><strong>${adherence.percent}%</strong> of doses marked as taken (${adherence.taken} of ${adherence.scheduled}), as recorded by the patient in the app.</p>`
        )
      : "",
    section("Diagnoses (recent)", diagnoses.length ? `<p>${diagnoses.map(esc).join(" · ")}</p>` : none("None recorded")),
    section(
      "Vitals",
      vitals.length
        ? `<div class="wrap"><table><thead><tr><th>Date</th><th>BP</th><th>Pulse</th><th>Weight</th><th>Sugar</th><th>Temp</th><th>SpO2</th></tr></thead><tbody>${vitals
            .map(
              ({ date, v }) =>
                `<tr><td>${esc(fmtDate(date))}</td>${["bp", "pulse", "weight", "bloodSugar", "temperature", "spo2"]
                  .map((k) => `<td>${esc(v?.[k] ?? "–")}</td>`)
                  .join("")}</tr>`
            )
            .join("")}</tbody></table></div>`
        : none("None recorded")
    ),
    section(
      "Test results",
      (tests.length
        ? tests
            .map(({ t }) => {
              const out = (t.results ?? []).filter((r: any) => r.flag === "high" || r.flag === "low");
              return `<p><strong>${esc(t.name)}</strong> <span class="muted">${t.completedDate ? esc(new Date(t.completedDate).toLocaleDateString("en-GB")) : ""}</span><br>${
                out.length
                  ? out
                      .map(
                        (r: any) =>
                          `<span class="warn">${r.flag === "high" ? "▲ High" : "▼ Low"}</span> ${esc(r.name)} ${esc(r.value)} ${esc(r.unit ?? "")} <span class="muted">(normal ${esc(r.referenceRange ?? "?")})</span>`
                      )
                      .join("<br>")
                  : esc(t.resultSummary ?? "Report uploaded")
              }</p>`;
            })
            .join("")
        : none("No test results uploaded")) +
        (pending.length ? `<p class="muted">Not done yet: ${pending.map(esc).join(", ")}</p>` : "")
    ),
    `<footer class="muted">Shared by the patient from the MediCare app. Details were read from prescriptions by AI and confirmed by the patient; please verify before clinical decisions. Link valid until ${esc(
      link.expiresAt.toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })
    )}.</footer>`,
  ].join("");

  return page(`${name} — health summary`, body);
};
