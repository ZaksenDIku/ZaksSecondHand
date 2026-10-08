import type { Condition, MarketEstimateResult } from "./types";
import { batteryFactor, conditionFactor } from "./product-parser";
import { nearestSupportedStorage, storageRatio } from "./catalog";

export interface RawObservation {
  specKey: string;
  canonicalKey: string;
  priceDkk: number;
  condition?: string | null;
  batteryHealth?: number | null;
  storageGb?: number | null;
  observedAt: number;
  origin?: string;
}

export interface SpecKeyParts {
  canonicalKey: string;
  dims: string[];
  storageGb: number | null;
  condition: string;
  screen: string | null;
  ramGb: number | null;
}

/** specKey layout: `canonicalKey|dim...|storage|condition` */
export function parseSpecKey(specKey: string): SpecKeyParts {
  const parts = specKey.split("|");
  const canonicalKey = parts[0];
  const dims = parts.slice(1);
  const condition = dims.length > 0 ? dims[dims.length - 1] : "unknown";
  const storageRaw = dims.length > 1 ? dims[dims.length - 2] : null;
  const storageGb = storageRaw && storageRaw !== "na" ? Number.parseInt(storageRaw, 10) : null;
  const isMac = canonicalKey.startsWith("macbook");
  const screen = isMac && dims.length > 3 && dims[0] !== "na" ? dims[0] : null;
  const ramRaw = isMac && dims.length > 3 && dims[1] !== "na" ? Number.parseInt(dims[1], 10) : NaN;
  return {
    canonicalKey,
    dims,
    storageGb: Number.isFinite(storageGb as number) ? (storageGb as number) : null,
    condition,
    screen,
    ramGb: Number.isFinite(ramRaw) ? ramRaw : null,
  };
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function median(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5);
}

/** Price translated into a single comparable unit (256GB / good / 90% battery). */
export function unitPrice(obs: RawObservation): number {
  const parts = parseSpecKey(obs.specKey);
  const storage = obs.storageGb ?? parts.storageGb;
  const cond = (obs.condition ?? parts.condition) as Condition;
  const denom =
    conditionFactor(cond) * batteryFactor(obs.batteryHealth ?? null) * storageRatio(storage ?? 128);
  return obs.priceDkk / (denom || 1);
}

function scaleTo(unit: number, storageGb: number | null, condition: string | null, battery: number | null): number {
  return unit * conditionFactor(condition ?? "good") * batteryFactor(battery) * storageRatio(storageGb ?? 128);
}

function confidenceFor(n: number): MarketEstimateResult["confidence"] {
  if (n <= 0) return "NONE";
  if (n < 8) return "LOW";
  if (n < 25) return "MEDIUM";
  return "HIGH";
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: Math.round(percentile(sorted, 0.5)),
    p25: Math.round(percentile(sorted, 0.25)),
    p75: Math.round(percentile(sorted, 0.75)),
    avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function trendOf(obs: RawObservation[], now: number): { trend7Pct: number | null; trend30Pct: number | null } {
  const day = 86400000;
  const recent7 = obs.filter((o) => now - o.observedAt <= 7 * day);
  const prior7to30 = obs.filter((o) => now - o.observedAt > 7 * day && now - o.observedAt <= 30 * day);
  const recent30 = obs.filter((o) => now - o.observedAt <= 30 * day);
  const older30 = obs.filter((o) => now - o.observedAt > 30 * day && now - o.observedAt <= 120 * day);

  let trend7Pct: number | null = null;
  if (recent7.length >= 3 && prior7to30.length >= 3) {
    const a = median(recent7.map(unitPrice));
    const b = median(prior7to30.map(unitPrice));
    if (b > 0) trend7Pct = Number((((a - b) / b) * 100).toFixed(1));
  }

  let trend30Pct: number | null = null;
  if (recent30.length >= 5 && older30.length >= 5) {
    const a = median(recent30.map(unitPrice));
    const b = median(older30.map(unitPrice));
    if (b > 0) trend30Pct = Number((((a - b) / b) * 100).toFixed(1));
  }

  return { trend7Pct, trend30Pct };
}

export interface EstimateOptions {
  specKey: string;
  canonicalKey: string;
  observations: RawObservation[];
  storageGb?: number | null;
  condition?: string | null;
  batteryHealth?: number | null;
  now?: number;
}

/**
 * Builds a market estimate from observed listings only.
 *
 * Basis hierarchy (first with data wins):
 *   DIRECT                exact spec match
 *   SIBLING_STORAGE       nearest storage tier, same model + condition
 *   CANONICAL             every observation of the model, unit-normalised
 *   NONE                  no data -> caller must show "no market data"
 */
export function computeEstimate(opts: EstimateOptions): MarketEstimateResult {
  const now = opts.now ?? Date.now();
  const all = opts.observations.filter((o) => o.priceDkk > 0);
  const targetStorage = opts.storageGb ?? parseSpecKey(opts.specKey).storageGb;
  const targetCondition = opts.condition ?? parseSpecKey(opts.specKey).condition;

  const direct = all.filter((o) => o.specKey === opts.specKey);
  let basis: MarketEstimateResult["basis"] = "DIRECT";
  let pool = direct;

  if (pool.length === 0 && targetStorage) {
    const near = nearestSupportedStorage(opts.canonicalKey, targetStorage);
    pool = all.filter((o) => {
      const p = parseSpecKey(o.specKey);
      return (
        o.canonicalKey === opts.canonicalKey &&
        p.condition === targetCondition &&
        (p.storageGb ?? -1) === (near ?? -2)
      );
    });
    if (pool.length > 0) basis = "SIBLING_STORAGE";
  }

  if (pool.length === 0) {
    pool = all.filter((o) => o.canonicalKey === opts.canonicalKey);
    if (pool.length > 0) basis = "CANONICAL";
  }

  if (pool.length === 0) {
    return {
      specKey: opts.specKey,
      canonicalKey: opts.canonicalKey,
      basis: "NONE",
      sampleCount: 0,
      median: null,
      p25: null,
      p75: null,
      avg: null,
      min: null,
      max: null,
      fairValue: null,
      quickSale: null,
      trend7Pct: null,
      trend30Pct: null,
      confidence: "NONE",
      updatedAt: now,
    };
  }

  // Every observation is first expressed as a unit price (normalised for its
  // own storage / condition / battery), then scaled back up to the exact
  // configuration being valued. This keeps DIRECT matches reporting real
  // observed prices instead of index numbers.
  const targetBattery = opts.batteryHealth ?? null;
  const toTarget = (unit: number) => scaleTo(unit, targetStorage, targetCondition, targetBattery);

  // Round only after scaling back to the target configuration, otherwise the
  // unit rounding error is amplified by the scale factor.
  const s = stats(pool.map(unitPrice));
  const round = (n: number) => Math.round(n);
  const median = round(toTarget(s.median));
  const fairValue = median;
  const quickSale = round(toTarget(s.p25));
  const { trend7Pct, trend30Pct } = trendOf(pool, now);

  return {
    specKey: opts.specKey,
    canonicalKey: opts.canonicalKey,
    basis,
    sampleCount: pool.length,
    median,
    p25: quickSale,
    p75: round(toTarget(s.p75)),
    avg: round(toTarget(s.avg)),
    min: round(toTarget(s.min)),
    max: round(toTarget(s.max)),
    fairValue,
    quickSale,
    trend7Pct,
    trend30Pct,
    confidence: confidenceFor(pool.length),
    updatedAt: now,
  };
}

/** Aggregated heatmap rows: model -> market price / buy below / steal below. */
export interface HeatmapRow {
  canonicalKey: string;
  label: string;
  storageGb: number | null;
  specKey: string;
  sampleCount: number;
  median: number | null;
  buyBelow: number | null;
  stealBelow: number | null;
  confidence: MarketEstimateResult["confidence"];
  trend30Pct: number | null;
}

export const BUY_BELOW_PCT = 12;
export const STEAL_BELOW_PCT = 25;

export function heatRowFromEstimate(
  est: MarketEstimateResult,
  label: string,
  storageGb: number | null
): HeatmapRow {
  const median = est.median;
  return {
    canonicalKey: est.canonicalKey,
    label,
    storageGb,
    specKey: est.specKey,
    sampleCount: est.sampleCount,
    median,
    buyBelow: median ? Math.round(median * (1 - BUY_BELOW_PCT / 100)) : null,
    stealBelow: median ? Math.round(median * (1 - STEAL_BELOW_PCT / 100)) : null,
    confidence: est.confidence,
    trend30Pct: est.trend30Pct,
  };
}
