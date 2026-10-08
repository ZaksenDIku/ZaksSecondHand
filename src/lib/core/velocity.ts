import type { ProductType } from "./types";

/**
 * 💨 DEAL VELOCITY
 *
 * An estimate of how fast a listing is likely to disappear. This is a
 * heuristic, never a promise: it blends listing age, discount depth, model
 * popularity (derived from observation counts in this database), price level
 * and - when available - how fast comparable listings aged out historically.
 *
 * Levels: 🐢 LOW · 🕐 NORMAL · ⚡ FAST · 💨 VERY FAST · 🚨 EXTREME
 */
export type VelocityLevel = "LOW" | "NORMAL" | "FAST" | "VERY_FAST" | "EXTREME";

export interface VelocityInput {
  postedAt: number | null;
  now?: number;
  discountPct: number | null;
  dealScore: number;
  /** Number of observations for this exact configuration (popularity proxy). */
  sampleCount: number;
  /** Observations of the same model across all configurations. */
  modelSampleCount?: number;
  priceDkk: number;
  marketMedianDkk: number | null;
  productType: ProductType | null;
  /** Median hours comparable listings stayed active, when measured. */
  historicalLifetimeHours?: number | null;
}

export interface VelocityResult {
  level: VelocityLevel;
  score: number;
  emoji: string;
  label: string;
  /** Danish explanation shown next to the badge. */
  reason: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
}

export const VELOCITY_META: Record<VelocityLevel, { emoji: string; label: string; tone: string }> = {
  LOW: { emoji: "🐢", label: "LAV", tone: "dim" },
  NORMAL: { emoji: "🕐", label: "NORMAL", tone: "info" },
  FAST: { emoji: "⚡", label: "HURTIG", tone: "warn" },
  VERY_FAST: { emoji: "💨", label: "MEGET HURTIG", tone: "great" },
  EXTREME: { emoji: "🚨", label: "EKSTREM", tone: "steal" },
};

export function computeVelocity(input: VelocityInput): VelocityResult {
  const now = input.now ?? Date.now();
  const ageHours = input.postedAt ? Math.max(0, (now - input.postedAt) / 3600000) : 48;
  let score = 50;

  // Fresh listings are the whole point: the younger, the higher the pressure.
  if (ageHours <= 1) score += 28;
  else if (ageHours <= 3) score += 22;
  else if (ageHours <= 6) score += 15;
  else if (ageHours <= 12) score += 8;
  else if (ageHours <= 24) score += 3;
  else if (ageHours > 72) score -= 12;

  // Discount creates competition from other buyers.
  const discount = input.discountPct ?? 0;
  if (discount >= 35) score += 20;
  else if (discount >= 25) score += 15;
  else if (discount >= 15) score += 10;
  else if (discount >= 8) score += 5;
  else if (discount < 0) score -= 8;

  // Popularity proxy: configurations with many observations move faster.
  if (input.sampleCount >= 12) score += 10;
  else if (input.sampleCount >= 6) score += 6;
  else if (input.sampleCount >= 3) score += 3;
  else if (input.sampleCount > 0) score += 1;

  if (input.productType === "iphone") score += 4;

  // Below-market absolute price attracts non-flippers too.
  if (input.marketMedianDkk && input.priceDkk < input.marketMedianDkk * 0.6) score += 6;

  // Measured history wins over the heuristic when we have it.
  if (input.historicalLifetimeHours && input.historicalLifetimeHours > 0) {
    if (input.historicalLifetimeHours <= 12) score += 12;
    else if (input.historicalLifetimeHours <= 24) score += 6;
    else if (input.historicalLifetimeHours >= 96) score -= 10;
  }

  score += (input.dealScore - 70) * 0.25;

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const level: VelocityLevel =
    clamped >= 85 ? "EXTREME" : clamped >= 70 ? "VERY_FAST" : clamped >= 58 ? "FAST" : clamped >= 40 ? "NORMAL" : "LOW";
  const meta = VELOCITY_META[level];

  return {
    level,
    score: clamped,
    emoji: meta.emoji,
    label: meta.label,
    // Measured history is the strongest confidence signal; the raw sample size
    // only tells us how much of the model we have seen, not how fast it moves.
    confidence:
      input.historicalLifetimeHours && input.historicalLifetimeHours > 0
        ? "HIGH"
        : input.sampleCount >= 6
          ? "MEDIUM"
          : input.sampleCount >= 3
            ? "LOW"
            : "LOW",
    reason: reasonFor(level, ageHours, discount, input.sampleCount),
  };
}

function reasonFor(level: VelocityLevel, ageHours: number, discount: number, sample: number): string {
  const parts: string[] = [];
  if (ageHours <= 3) parts.push(`kun ${Math.max(1, Math.round(ageHours * 60))} min. gammel`);
  else if (ageHours <= 12) parts.push(`${Math.round(ageHours)} timer siden oprettet`);
  if (discount >= 20) parts.push(`${Math.round(discount)} % under markedsværdien`);
  if (sample >= 6) parts.push(`${sample} sammenlignelige fund i datasættet`);

  switch (level) {
    case "EXTREME":
      return `Estimat: forsvinder meget hurtigt — ${parts.join(", ")}.`;
    case "VERY_FAST":
      return `Estimat: sammenlignelige annoncer forsvinder typisk hurtigt — ${parts.join(", ")}.`;
    case "FAST":
      return `Estimat: bevæger sig hurtigt — ${parts.join(", ") || "almindeligt niveau"}.`;
    case "NORMAL":
      return `Estimat: normalt tempo — ${parts.join(", ") || "ingen stærke signaler"}.`;
    default:
      return `Estimat: lavt tempo — ${parts.join(", ") || "ældre end normal markedstid"}.`;
  }
}
