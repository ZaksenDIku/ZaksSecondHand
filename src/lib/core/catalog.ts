import type { ProductType } from "./types";

/**
 * Static product knowledge: what models exist, how liquid they are, and how
 * storage tiers relate to each other. This contains NO price data.
 * All prices come from observed listings (see market-value.ts).
 */

export interface ModelDefinition {
  canonicalKey: string;
  label: string;
  productType: ProductType;
  generation: string | null;
  variant: string | null;
  releaseYear: number | null;
  /** 0..1 — how quickly this model tends to sell on the Danish second-hand market */
  liquidity: number;
  /** 0..1 — desirability of the most common configuration */
  storageDesirability: number;
  scope: "core" | "extended";
}

/** Relative price step per storage tier (ratios, not absolute prices). */
export const STORAGE_RATIO: Record<number, number> = {
  64: 0.86,
  128: 1,
  256: 1.14,
  512: 1.3,
  1024: 1.44,
  2048: 1.6,
};

export const STORAGE_LIQUIDITY: Record<number, number> = {
  64: 0.35,
  128: 0.72,
  256: 1,
  512: 0.84,
  1024: 0.62,
  2048: 0.45,
};

const IPHONE_STORAGE: Record<string, number[]> = {
  "iphone:15": [128, 256, 512],
  "iphone:15-plus": [128, 256, 512],
  "iphone:15-pro": [128, 256, 512, 1024],
  "iphone:15-pro-max": [256, 512, 1024],
  "iphone:16": [128, 256, 512],
  "iphone:16-plus": [128, 256, 512],
  "iphone:16-pro": [128, 256, 512, 1024],
  "iphone:16-pro-max": [256, 512, 1024],
  "iphone:16e": [128, 256, 512],
  "iphone:17": [256, 512],
  "iphone:17-air": [256, 512],
  "iphone:17-pro": [256, 512, 1024],
  "iphone:17-pro-max": [256, 512, 1024, 2048],
  "iphone:17e": [128, 256, 512],
};

function iphoneModels(): ModelDefinition[] {
  const defs: ModelDefinition[] = [];
  const push = (
    gen: string,
    variant: string | null,
    liquidity: number,
    desirability: number,
    year: number | null,
    scope: "core" | "extended"
  ) => {
    const slug = variant ? `${gen}-${variant.toLowerCase().replace(/\s+/g, "-")}` : gen;
    defs.push({
      canonicalKey: `iphone:${slug}`,
      label: variant ? `iPhone ${gen} ${variant}` : `iPhone ${gen}`,
      productType: "iphone",
      generation: gen,
      variant,
      releaseYear: year,
      liquidity,
      storageDesirability: desirability,
      scope,
    });
  };

  push("15", null, 0.7, 0.72, 2023, "extended");
  push("15", "Plus", 0.5, 0.55, 2023, "extended");
  push("15", "Pro", 0.85, 0.9, 2023, "core");
  push("15", "Pro Max", 0.88, 0.9, 2023, "core");
  push("16", null, 0.8, 0.8, 2024, "core");
  push("16", "Plus", 0.55, 0.6, 2024, "core");
  push("16", "Pro", 0.95, 1, 2024, "core");
  push("16", "Pro Max", 0.95, 0.97, 2024, "core");
  push("16e", null, 0.6, 0.58, 2025, "core");
  push("17", null, 0.78, 0.8, 2025, "core");
  push("17", "Air", 0.7, 0.72, 2025, "core");
  push("17", "Pro", 0.9, 0.95, 2025, "core");
  push("17", "Pro Max", 0.9, 0.93, 2025, "core");
  push("17e", null, 0.5, 0.5, 2026, "extended");
  // Older generations still parsed so historical data can be understood.
  push("14", null, 0.6, 0.6, 2022, "extended");
  push("14", "Plus", 0.42, 0.45, 2022, "extended");
  push("14", "Pro", 0.66, 0.7, 2022, "extended");
  push("14", "Pro Max", 0.68, 0.7, 2022, "extended");
  push("13", null, 0.58, 0.55, 2021, "extended");
  push("13", "mini", 0.3, 0.3, 2021, "extended");
  push("13", "Pro", 0.5, 0.55, 2021, "extended");
  push("13", "Pro Max", 0.52, 0.55, 2021, "extended");
  push("12", null, 0.4, 0.4, 2020, "extended");
  push("12", "Pro", 0.34, 0.36, 2020, "extended");
  push("12", "Pro Max", 0.36, 0.38, 2020, "extended");
  push("SE", "3", 0.3, 0.3, 2022, "extended");
  return defs;
}

function macModels(): ModelDefinition[] {
  const defs: ModelDefinition[] = [];
  const push = (
    family: "MacBook Air" | "MacBook Pro",
    chip: string,
    screen: string | null,
    year: number | null,
    liquidity: number,
    desirability: number,
    scope: "core" | "extended"
  ) => {
    const famSlug = family.toLowerCase().replace(/\s+/g, "-");
    defs.push({
      canonicalKey: `${famSlug}:${chip.toLowerCase().replace(/\s+/g, "-")}`,
      label: `${family}${screen ? ` ${screen}` : ""} ${chip}`,
      productType: "macbook",
      generation: chip,
      variant: family === "MacBook Pro" ? "Pro" : "Air",
      releaseYear: year,
      liquidity,
      storageDesirability: desirability,
      scope,
    });
  };

  const airs: Array<[string, number, number, "core" | "extended"]> = [
    ["M1", 0.75, 0.78, "extended"],
    ["M2", 0.8, 0.82, "core"],
    ["M3", 0.82, 0.85, "core"],
    ["M4", 0.8, 0.86, "core"],
    ["M5", 0.6, 0.7, "core"],
  ];
  for (const [chip, liq, des, scope] of airs) push("MacBook Air", chip, null, null, liq, des, scope);

  const pros: Array<[string, number, number, "core" | "extended"]> = [
    ["M1 Pro", 0.6, 0.66, "extended"],
    ["M1 Max", 0.5, 0.6, "extended"],
    ["M2 Pro", 0.66, 0.72, "extended"],
    ["M2 Max", 0.55, 0.65, "extended"],
    ["M3 Pro", 0.78, 0.82, "core"],
    ["M3 Max", 0.66, 0.74, "core"],
    ["M4 Pro", 0.8, 0.86, "core"],
    ["M4 Max", 0.7, 0.78, "core"],
    ["M5 Pro", 0.6, 0.7, "core"],
    ["M5 Max", 0.55, 0.65, "core"],
    ["M3", 0.7, 0.75, "core"],
    ["M4", 0.72, 0.78, "core"],
    ["M2", 0.6, 0.64, "extended"],
    ["M1", 0.5, 0.5, "extended"],
  ];
  for (const [chip, liq, des, scope] of pros) push("MacBook Pro", chip, null, null, liq, des, scope);

  return defs;
}

export const MODEL_CATALOG: ModelDefinition[] = [...iphoneModels(), ...macModels()];

export const CATALOG_BY_KEY = new Map(MODEL_CATALOG.map((m) => [m.canonicalKey, m]));

export function lookupModel(canonicalKey: string): ModelDefinition | null {
  return CATALOG_BY_KEY.get(canonicalKey) ?? null;
}

/** Storage tiers supported by a model — used to detect parser ambiguity. */
export function supportedStorage(canonicalKey: string): number[] | null {
  if (canonicalKey.startsWith("iphone:")) return IPHONE_STORAGE[canonicalKey] ?? null;
  if (canonicalKey.startsWith("macbook")) return [256, 512, 1024, 2048];
  return null;
}

export function storageRatio(storageGb: number): number {
  return STORAGE_RATIO[storageGb] ?? 1;
}

export function storageLiquidity(storageGb: number | null): number {
  if (!storageGb) return 0.5;
  return STORAGE_LIQUIDITY[storageGb] ?? 0.5;
}

/**
 * The default target scope for the dashboard: iPhone 15 and newer, and Apple
 * Silicon MacBooks from M1 onwards. Everything else parses but is out of scope.
 */
export function isCoreScope(canonicalKey: string, productType: string): boolean {
  if (productType === "iphone") {
    const gen = canonicalKey.split(":")[1] ?? "";
    const num = Number.parseInt(gen, 10);
    if (Number.isFinite(num)) return num >= 15;
    return false;
  }
  if (productType === "macbook") return true;
  return false;
}

/** Ordered storage list nearest-to-target helper for sibling derivation. */
export function nearestSupportedStorage(canonicalKey: string, target: number): number | null {
  const list = supportedStorage(canonicalKey);
  if (!list || list.length === 0) return null;
  return list.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), list[0]);
}
