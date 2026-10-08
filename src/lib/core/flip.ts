import type { FlipInput, FlipResult } from "./types";

/**
 * Flip economics. Every cost is explicit so the net number is never a guess
 * dressed up as a profit.
 */
export function computeFlip(input: FlipInput): FlipResult {
  const fees = Math.round((input.purchasePrice * input.platformFeePct) / 100);
  const totalCost = Math.round(
    input.purchasePrice +
      fees +
      input.transportDkk +
      input.repairAllowanceDkk -
      input.negotiationAdjustmentDkk
  );
  const grossProfit = Math.round(input.expectedResale - input.purchasePrice);
  const netProfit = Math.round(input.expectedResale - totalCost);
  const roiPct = totalCost > 0 ? Number(((netProfit / totalCost) * 100).toFixed(1)) : 0;
  return { totalCost, grossProfit, netProfit, roiPct };
}

/** 💸 Flip lifecycle: 💬 CONTACTED → 🤝 NEGOTIATING → 🛒 PURCHASED → 📦 PREPARING → 🏷 LISTED → 💸 SOLD */
export type FlipStatus = "CONTACTED" | "NEGOTIATING" | "PURCHASED" | "PREPARING" | "LISTED" | "SOLD";

export const FLIP_STATUSES: FlipStatus[] = [
  "CONTACTED",
  "NEGOTIATING",
  "PURCHASED",
  "PREPARING",
  "LISTED",
  "SOLD",
];

export const FLIP_STATUS_META: Record<FlipStatus, { emoji: string; label: string; tone: string }> = {
  CONTACTED: { emoji: "💬", label: "KONTAKTET", tone: "info" },
  NEGOTIATING: { emoji: "🤝", label: "FORHANDLER", tone: "warn" },
  PURCHASED: { emoji: "🛒", label: "KØBT", tone: "good" },
  PREPARING: { emoji: "📦", label: "KLARGØRER", tone: "elevated" },
  LISTED: { emoji: "🏷", label: "TIL SALG", tone: "great" },
  SOLD: { emoji: "💸", label: "SOLGT", tone: "hot" },
};

export interface FlipDefaults {
  platformFeePct: number;
  transportDkk: number;
  repairAllowanceDkk: number;
}

export const FLIP_DEFAULTS: FlipDefaults = {
  platformFeePct: 0,
  transportDkk: 100,
  repairAllowanceDkk: 0,
};

/** Conservative resale target: quick-sale (p25) when available, else fair value. */
export function resaleTarget(fairValue: number | null, quickSale: number | null): number | null {
  if (quickSale && fairValue) return Math.max(quickSale, Math.round(fairValue * 0.85));
  if (fairValue) return Math.round(fairValue * 0.9);
  return null;
}

export interface FlipRecord {
  purchasePriceDkk: number;
  expensesDkk: number;
  salePriceDkk: number | null;
}

export function flipProfit(record: FlipRecord): number | null {
  if (record.salePriceDkk === null || record.salePriceDkk === undefined) return null;
  return record.salePriceDkk - record.purchasePriceDkk - record.expensesDkk;
}

export function flipRoi(record: FlipRecord): number | null {
  const cost = record.purchasePriceDkk + record.expensesDkk;
  if (record.salePriceDkk === null || record.salePriceDkk === undefined || cost <= 0) return null;
  return Number((((record.salePriceDkk - cost) / cost) * 100).toFixed(1));
}

export function daysHeld(purchase: number, sale: number | null): number {
  const end = sale ?? Date.now();
  return Math.max(0, Math.round((end - purchase) / 86400000));
}
