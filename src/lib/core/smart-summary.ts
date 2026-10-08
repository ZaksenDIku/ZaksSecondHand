import type { DataOrigin } from "./types";

/** Signals that lower risk rather than raise it. */
const TRUST_CODES = new Set(["HAS_RECEIPT", "FIND_MY_OFF", "UNTESTED_NETWORK"]);

/**
 * 🧠 SMART DEAL SUMMARY
 *
 * Turns a listing's real, already-computed attributes into a short list of
 * reasons. Every bullet is derived from stored data — no invented commentary.
 */
export interface SummaryLine {
  emoji: string;
  text: string;
  tone: "good" | "great" | "steal" | "info" | "warn" | "danger" | "dim";
}

export interface SmartSummaryInput {
  title: string;
  priceDkk: number;
  marketValueDkk: number | null;
  quickSaleValueDkk: number | null;
  discountPct: number | null;
  netProfitDkk: number | null;
  roiPct: number | null;
  dealScore: number;
  riskScore: number;
  riskLevel: string;
  ageMin: number;
  batteryHealth: number | null;
  estimateSample: number;
  estimateConfidence: string;
  storageGb: number | null;
  productType: string | null;
  distanceKm: number | null;
  origin: DataOrigin;
  parseConfidence: number;
  parseAmbiguous: boolean;
  riskCodes: string[];
  snapshotCount: number;
  priceDrop: number | null;
  velocityLabel: string;
}

export function smartSummary(i: SmartSummaryInput): SummaryLine[] {
  const lines: SummaryLine[] = [];

  if (i.discountPct !== null && i.discountPct >= 5) {
    lines.push({
      emoji: "✅",
      tone: i.discountPct >= 25 ? "steal" : i.discountPct >= 15 ? "great" : "good",
      text: `${Math.round(i.discountPct)} % under estimeret markedspris`,
    });
  } else if (i.discountPct !== null && i.discountPct < 0) {
    lines.push({ emoji: "📈", tone: "warn", text: `${Math.abs(Math.round(i.discountPct))} % over estimeret markedspris` });
  } else if (i.marketValueDkk === null) {
    lines.push({ emoji: "ℹ️", tone: "dim", text: "Ingen markedsværdi endnu — for få observationer i datasættet" });
  } else {
    lines.push({ emoji: "🔵", tone: "info", text: "Prisen ligger tæt på estimeret markedsværdi" });
  }

  if (i.ageMin <= 45) {
    lines.push({ emoji: "⚡", tone: "great", text: `Opført for kun ${Math.max(1, Math.round(i.ageMin))} min. siden` });
  } else if (i.ageMin <= 360) {
    lines.push({ emoji: "🕐", tone: "info", text: `Opført for ${Math.round(i.ageMin / 60)} time(r) siden` });
  } else {
    lines.push({ emoji: "⏳", tone: "dim", text: `Annoncen er ${Math.round(i.ageMin / 60)} timer gammel` });
  }

  if (i.netProfitDkk !== null && i.netProfitDkk > 0) {
    lines.push({
      emoji: "💸",
      tone: i.netProfitDkk >= 1000 ? "great" : "good",
      text: `Estimeret nettofortjeneste: ${i.netProfitDkk.toLocaleString("da-DK")} kr${
        i.roiPct !== null ? ` (${Math.round(i.roiPct)} % ROI)` : ""
      }`,
    });
  } else if (i.netProfitDkk !== null) {
    lines.push({ emoji: "📉", tone: "warn", text: `Ingen beregnet fortjeneste efter omkostninger (${i.netProfitDkk} kr)` });
  }

  if (i.productType === "iphone") {
    const popular = i.storageGb !== null && [128, 256, 512].includes(i.storageGb) ? "ønsket lagerplads" : null;
    if (popular) lines.push({ emoji: "📱", tone: "info", text: `Efterspurgt model: ${popular} (${i.storageGb} GB)` });
  } else if (i.productType === "macbook") {
    if ((i.storageGb ?? 0) >= 512) {
      lines.push({ emoji: "💻", tone: "info", text: "512 GB+ er det mest efterspurgte segment på brugtmarkedet" });
    }
  }

  if (i.batteryHealth === null) {
    lines.push({ emoji: "⚠️", tone: "warn", text: "Batterihealth er ikke oplyst — bed om det før køb" });
  } else if (i.batteryHealth < 85) {
    lines.push({ emoji: "🔋", tone: "warn", text: `Batterihealth ${i.batteryHealth} % — forhøj reparationsreserve` });
  } else if (i.batteryHealth >= 95) {
    lines.push({ emoji: "🔋", tone: "good", text: `Batterihealth ${i.batteryHealth} %` });
  }

  if (i.priceDrop !== null && i.priceDrop > 0) {
    lines.push({ emoji: "📉", tone: "good", text: `Prisen er faldet ${i.priceDrop.toLocaleString("da-DK")} kr siden første hentning` });
  }

  if (i.distanceKm !== null) {
    lines.push({ emoji: "📍", tone: i.distanceKm <= 15 ? "good" : "dim", text: `${Math.round(i.distanceKm)} km væk` });
  }

  // Trust signals carry a negative weight, so they are reassurance, not risk.
  // Mixing them into one list told users "Kvittering haves" was a risk factor.
  const riskCodes = i.riskCodes.filter((c) => !TRUST_CODES.has(c));
  if (riskCodes.length > 0) {
    lines.push({
      emoji: riskCodes.some((c) => /mdm|activation|icloud|find_my|imei/i.test(c)) ? "⛔" : "🚩",
      tone: i.riskScore >= 70 ? "danger" : i.riskScore >= 40 ? "warn" : "info",
      text: `Risikofaktorer: ${riskCodes.slice(0, 3).join(", ")}`,
    });
  }
  if (i.riskCodes.length !== riskCodes.length) {
    lines.push({
      emoji: "🛡",
      tone: "good",
      text: `Tryghedssignaler: ${i.riskCodes.filter((c) => TRUST_CODES.has(c)).join(", ")}`,
    });
  }

  lines.push({
    emoji:
      i.riskLevel === "LOW" ? "🟢" : i.riskLevel === "AVOID" ? "⛔" : i.riskScore >= 70 ? "🔴" : i.riskScore >= 40 ? "🟠" : "🟡",
    tone: i.riskLevel === "LOW" ? "good" : i.riskLevel === "AVOID" ? "danger" : i.riskScore >= 40 ? "warn" : "info",
    text: `Samlet risiko: ${i.riskLevel} (${i.riskScore}/100) — uafhængig af DealScore`,
  });

  if (i.estimateSample < 3) {
    lines.push({
      emoji: "⚠️",
      tone: "warn",
      text: `Markedsværdien bygger kun på ${i.estimateSample} observation${i.estimateSample === 1 ? "" : "er"}`,
    });
  }

  if (i.parseAmbiguous || i.parseConfidence < 0.55) {
    lines.push({ emoji: "🟣", tone: "info", text: "🟣 AI PARSED — modellen er udledt automatisk, bekræft specifikationerne" });
  }

  if (i.origin === "DEMO") {
    lines.push({ emoji: "⚪", tone: "dim", text: "DEMO-fixture — ikke en rigtig markedsplads-annonce" });
  }
  if (i.origin === "STALE") {
    lines.push({ emoji: "🟡", tone: "warn", text: "STALE — data er ældre end friskhedsvinduet" });
  }

  return lines;
}
