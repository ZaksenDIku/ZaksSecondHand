import type {
  Condition,
  DealScoreInput,
  DealScoreResult,
  DealScoreWeights,
  DealTier,
} from "./types";
import { clamp } from "./format";

export const DEFAULT_WEIGHTS: DealScoreWeights = {
  discount: 30,
  age: 15,
  resaleStrength: 10,
  liquidity: 9,
  storageDesirability: 5,
  condition: 5,
  battery: 5,
  sellerTrust: 5,
  completeness: 5,
  geography: 3,
  demand: 3,
  riskPenalty: 15,
};

/** Discount % -> 0..1, piecewise linear on the tier boundaries. */
export function discountComponent(discountPct: number | null): number {
  if (discountPct === null || discountPct === undefined) return 0;
  const d = clamp(discountPct, 0, 60);
  const stops: Array<[number, number]> = [
    [0, 0],
    [8, 0.4],
    [15, 0.62],
    [25, 0.84],
    [40, 1],
    [60, 1],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (d <= x1) return y0 + ((d - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1;
}

/** Minutes since listing -> 0..1, heavily favouring brand new listings. */
export function ageComponent(minutes: number): number {
  const m = Math.max(0, minutes);
  const stops: Array<[number, number]> = [
    [0, 1],
    [15, 0.96],
    [60, 0.86],
    [180, 0.72],
    [360, 0.6],
    [1440, 0.4],
    [4320, 0.22],
    [10080, 0.1],
    [43200, 0],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (m <= x1) return y0 + ((m - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0;
}

export function conditionComponent(condition: Condition | string | null): number {
  switch (condition) {
    case "new": return 1;
    case "like_new": return 0.92;
    case "good": return 0.78;
    case "fair": return 0.5;
    case "poor": return 0.15;
    default: return 0.5;
  }
}

export function batteryComponent(battery: number | null): number {
  if (battery === null || battery === undefined) return 0.55;
  if (battery >= 95) return 1;
  if (battery >= 90) return 0.9;
  if (battery >= 85) return 0.76;
  if (battery >= 80) return 0.6;
  if (battery >= 75) return 0.4;
  if (battery >= 70) return 0.2;
  return 0.05;
}

/**
 * How close the quick-sale value sits to the fair value: a narrow spread means
 * the asset converts to cash without giving away much margin.
 */
export function resaleStrengthComponent(fair: number | null, quickSale: number | null): number {
  if (!fair || !quickSale || fair <= 0) return 0.4;
  const ratio = quickSale / fair;
  return clamp((ratio - 0.72) / (0.94 - 0.72), 0, 1);
}

export function geographyComponent(distanceKm: number | null): number {
  if (distanceKm === null || distanceKm === undefined) return 0.5;
  const stops: Array<[number, number]> = [
    [0, 1],
    [10, 0.95],
    [30, 0.8],
    [60, 0.62],
    [120, 0.4],
    [250, 0.18],
    [500, 0.05],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (distanceKm <= x1) return y0 + ((distanceKm - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 0.02;
}

/** 0..1 where 1 = lots of competing supply (harder to flip fast). */
export function demandComponent(demandPressure: number): number {
  return clamp(1 - demandPressure, 0, 1);
}

export function computeDealScore(
  input: DealScoreInput,
  weights: DealScoreWeights = DEFAULT_WEIGHTS
): DealScoreResult {
  const components: Record<string, number> = {
    discount: discountComponent(input.discountPct),
    age: ageComponent(input.listingAgeMinutes),
    resaleStrength: resaleStrengthComponent(input.marketValue, input.quickSale),
    liquidity: clamp(input.liquidity, 0, 1),
    storageDesirability: clamp(input.storageDesirability, 0, 1),
    condition: conditionComponent(input.condition),
    battery: batteryComponent(input.batteryHealth),
    sellerTrust: clamp(input.sellerTrust, 0, 1),
    completeness: clamp(input.completeness, 0, 1),
    geography: geographyComponent(input.distanceKm),
    demand: demandComponent(input.demandPressure),
  };

  let totalWeight = 0;
  let acc = 0;
  for (const [key, value] of Object.entries(components)) {
    const w = weights[key as keyof DealScoreWeights] ?? 0;
    totalWeight += w;
    acc += w * value;
  }
  const base = totalWeight > 0 ? (acc / totalWeight) * 100 : 0;
  const riskFactor = clamp(input.riskScore, 0, 100) / 100;
  const penalty = (weights.riskPenalty ?? 0) * riskFactor;
  const score = clamp(Math.round(base - penalty), 0, 100);

  return {
    score,
    tier: tierFor(score, input.discountPct, {
      ageMinutes: input.listingAgeMinutes,
      netProfitDkk: input.netProfitDkk ?? null,
      roiPct: input.roiPct ?? null,
    }),
    components,
    weights,
    penalty: Math.round(penalty),
  };
}

/**
 * Tier follows the headline discount rules (STEAL >= 25%, GREAT 15-25%,
 * GOOD 8-15%, FAIR < 8%) but a listing must also clear a score floor, so a
 * risky 27% discount does not get labelled a steal.
 */
export function tierFor(
  score: number,
  discountPct: number | null,
  context: { ageMinutes?: number; netProfitDkk?: number | null; roiPct?: number | null } = {}
): DealTier {
  const d = discountPct ?? 0;
  const ageMin = context.ageMinutes ?? Number.POSITIVE_INFINITY;
  const profit = context.netProfitDkk ?? null;
  const roi = context.roiPct ?? null;

  // Base band from the score itself.
  let tier: DealTier = score >= 93 ? "URGENT" : score >= 85 ? "HOT" : score >= 75 ? "GREAT" : score >= 60 ? "GOOD" : "NORMAL";

  // 🚨 URGENT STEAL additionally needs: extreme discount, real margin and freshness.
  if (tier === "URGENT") {
    const strong =
      d >= 22 && ageMin <= 720 && (profit === null || profit >= 400) && (roi === null || roi >= 10);
    if (!strong) tier = "HOT";
  }
  // Demote stale opportunities regardless of score.
  if (tier !== "NORMAL" && ageMin > 4320) tier = tier === "URGENT" ? "HOT" : "GREAT";
  // A great score without any real discount is not a great deal.
  if (tier === "GREAT" && d < 6) tier = "GOOD";
  if (tier === "HOT" && d < 10) tier = "GREAT";
  if (tier === "URGENT" && d < 15) tier = "HOT";
  // Negative expected margin never reads as an opportunity.
  if (profit !== null && profit < 0 && tier !== "NORMAL") tier = "GOOD";

  return tier;
}

export const TIER_META: Record<DealTier, { label: string; symbol: string; tone: string }> = {
  NORMAL: { label: "NORMAL", symbol: "🔵", tone: "normal" },
  GOOD: { label: "GOOD", symbol: "🟢", tone: "good" },
  GREAT: { label: "GREAT", symbol: "🟠", tone: "great" },
  HOT: { label: "🔥 HOT", symbol: "🔥", tone: "hot" },
  URGENT: { label: "🚨 URGENT STEAL", symbol: "🚨", tone: "urgent" },
};
