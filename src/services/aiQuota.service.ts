import { AiUsageModel } from "../models/aiUsage.model";
import { createServiceError } from "../lib/utils";

export type AiFeature = "scan" | "lab" | "interactions" | "generic" | "summary";

const num = (key: string, fallback: number) => {
  const v = parseInt(process.env[key] || "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

// Per-user daily free limits and a global daily cap (bill-shock guard).
// Override with env vars, e.g. AI_LIMIT_SCAN=10.
export const aiLimits = (): Record<AiFeature, number> => ({
  scan: num("AI_LIMIT_SCAN", 5),
  lab: num("AI_LIMIT_LAB", 3),
  interactions: num("AI_LIMIT_INTERACTIONS", 10),
  generic: num("AI_LIMIT_GENERIC", 20),
  summary: num("AI_LIMIT_SUMMARY", 5),
});

const globalCap = () => num("AI_GLOBAL_DAILY_CAP", 3000);

// Rewarded-ad credits: watching an ad adds shared bonus credits for today.
const rewardCredits = () => num("AI_REWARD_CREDITS", 3);
const rewardMaxPerDay = () => num("AI_REWARD_MAX_PER_DAY", 3);
const bonusScope = (userId: string) => `u:${userId}:bonus`;
const claimsScope = (userId: string) => `u:${userId}:claims`;

const LABEL: Record<AiFeature, string> = {
  scan: "prescription scans",
  lab: "lab report reads",
  interactions: "interaction checks",
  generic: "alternative-medicine searches",
  summary: "AI summaries",
};

const today = () => new Date().toISOString().slice(0, 10);
const expiry = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

const bump = (scope: string, by: number) =>
  AiUsageModel.findOneAndUpdate(
    { scope, date: today() },
    { $inc: { count: by }, $setOnInsert: { expireAt: expiry() } },
    { upsert: true, new: true }
  );

// Returns true when the request was paid for with a bonus (rewarded-ad) credit.
async function consume(userId: string, feature: AiFeature): Promise<boolean> {
  const limit = aiLimits()[feature];
  const userScope = `u:${userId}:${feature}`;

  const global = await bump("global", 1);
  if (global.count > globalCap()) {
    await bump("global", -1);
    throw createServiceError(
      "Our AI is very busy today. Please try again later.",
      503
    );
  }

  const used = await bump(userScope, 1);
  if (used.count <= limit) return false;

  const bonus = await AiUsageModel.findOneAndUpdate(
    { scope: bonusScope(userId), date: today(), count: { $gt: 0 } },
    { $inc: { count: -1 } },
    { new: true }
  );
  if (bonus) return true;

  await bump(userScope, -1);
  await bump("global", -1);
  throw createServiceError(
    `Daily free limit reached (${limit} ${LABEL[feature]}). Watch a short ad for more, or try again tomorrow.`,
    429,
    "AI_LIMIT"
  );
}

async function refund(userId: string, feature: AiFeature, usedBonus: boolean) {
  await bump(`u:${userId}:${feature}`, -1).catch(() => {});
  await bump("global", -1).catch(() => {});
  if (usedBonus) await bump(bonusScope(userId), 1).catch(() => {});
}

// Runs fn only if the user has quota left; refunds if fn throws.
export async function withAiQuota<T>(
  userId: string,
  feature: AiFeature,
  fn: () => Promise<T>
): Promise<T> {
  const usedBonus = await consume(userId, feature);
  try {
    return await fn();
  } catch (e) {
    await refund(userId, feature, usedBonus);
    throw e;
  }
}

// Called after the app finished showing a rewarded ad.
// NOTE: this trusts the client. Before relying on it in production, enable AdMob
// server-side verification (SSV) and verify the signed callback instead.
export async function claimAdReward(userId: string) {
  const claims = await bump(claimsScope(userId), 1);
  if (claims.count > rewardMaxPerDay()) {
    await bump(claimsScope(userId), -1);
    throw createServiceError(
      "You have used all of today's ad rewards. Come back tomorrow.",
      429,
      "REWARD_LIMIT"
    );
  }
  await bump(bonusScope(userId), rewardCredits());
  return getAiUsage(userId);
}

export async function getAiUsage(userId: string) {
  const limits = aiLimits();
  const features = Object.keys(limits) as AiFeature[];
  const docs = await AiUsageModel.find({
    scope: {
      $in: [
        ...features.map((f) => `u:${userId}:${f}`),
        bonusScope(userId),
        claimsScope(userId),
      ],
    },
    date: today(),
  });
  const countOf = (scope: string) =>
    Math.max(0, docs.find((d) => d.scope === scope)?.count || 0);

  const perFeature = features.reduce((acc, f) => {
    const used = countOf(`u:${userId}:${f}`);
    acc[f] = { used, limit: limits[f], remaining: Math.max(0, limits[f] - used) };
    return acc;
  }, {} as Record<AiFeature, { used: number; limit: number; remaining: number }>);

  return {
    ...perFeature,
    bonus: countOf(bonusScope(userId)),
    rewardsLeft: Math.max(0, rewardMaxPerDay() - countOf(claimsScope(userId))),
    rewardCredits: rewardCredits(),
  };
}
