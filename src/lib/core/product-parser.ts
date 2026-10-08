import type { Condition, ParsedProduct, ProductType } from "./types";
import {
  isCoreScope,
  lookupModel,
  storageLiquidity,
} from "./catalog";
import {normalizeText, parseBatteryHealth, parseRam, tokenize} from "./normalize";

const COLORS: Array<[RegExp, string]> = [
  [/\b(titan|titanium)\b/, "Titanium"],
  [/\b(desert)\b/, "Desert Titanium"],
  [/\b(natural) (titanium)?\b/, "Natural Titanium"],
  [/\b(white) titanium\b/, "White Titanium"],
  [/\b(black) titanium\b/, "Black Titanium"],
  [/\b(orange) titanium\b/, "Orange Titanium"],
  [/\b(ultramarine)\b/, "Ultramarine"],
  [/\b(sky)? ?blue\b/, "Blue"],
  [/\b(deep purple)\b/, "Deep Purple"],
  [/\b(lavender)\b/, "Lavender"],
  [/\b(graphite)\b/, "Graphite"],
  [/\b(midnight)\b/, "Midnight"],
  [/\b(starlight)\b/, "Starlight"],
  [/\b(space black|spacegray|space grey|space gray|grå|gra)\b/, "Space Grey"],
  [/\b(silver|sølv|silver)\b/, "Silver"],
  [/\b(gold|guld)\b/, "Gold"],
  [/\b(pink|rosa)\b/, "Pink"],
  [/\b(red|rød)\b/, "Red"],
  [/\b(green|grøn)\b/, "Green"],
  [/\b(yellow|gul)\b/, "Yellow"],
  [/\b(ultrawhite|hvid|white)\b/, "White"],
  [/\b(black|sort|sorte)\b/, "Black"],
  [/\b(purple|lilla)\b/, "Purple"],
  [/\b(coral)\b/, "Coral"],
];

function detectCondition(text: string): Condition {
  const t = ` ${normalizeText(text)} `;
  if (/\b(defekt|ikke fungerende|knust|i stykker|reservedel|dræbt|dead)\b/.test(t)) return "poor";
  if (/\b(slidt|ridser|skrammer|meget brugt|repareret|reparerede|scratch(es)?|dents?)\b/.test(t)) return "fair";
  if (/\b(som ny|naesten ny|naesten som ny|like new|as good as new|uabnet|uabet)\b/.test(t)) return "like_new";
  if (/\b(ny|nyt|ubrugt|sealed|brand new|neu|med folie|uopened)\b/.test(t)) return "new";
  if (/\b(brugt|god stand|god|pæn|paen|fine|anvendt|used|preloved|velholdt)\b/.test(t)) return "good";
  return "unknown";
}

function detectColor(text: string): string | null {
  for (const [re, label] of COLORS) {
    if (re.test(text)) return label;
  }
  return null;
}

/** Finds a storage value, preferring explicitly unit-suffixed matches. */
function findStorage(text: string, exclude: number[] = []): number | null {
  const unitMatches = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(tb|t|gb|ssd|g)\b/gi)];
  for (const m of unitMatches) {
    const raw = Number.parseFloat(m[1].replace(",", "."));
    if (!Number.isFinite(raw)) continue;
    const unit = m[2].toLowerCase();
    const gb = unit === "tb" || unit === "t" ? raw * 1024 : raw;
    if (gb >= 64 && gb <= 4096 && !exclude.includes(gb)) return Math.round(gb);
  }
  // Bare numbers that can only be storage.
  const bare = [...text.matchAll(/\b(64|128|256|512|1024|2048)\b/gi)];
  for (const m of bare) {
    const n = Number.parseInt(m[1], 10);
    if (!exclude.includes(n)) return n;
  }
  return null;
}

function normalizeVariant(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/\s+/g, "");
  if (v === "promax") return "Pro Max";
  if (v === "pro") return "Pro";
  if (v === "plus") return "Plus";
  if (v === "mini") return "mini";
  if (v === "e") return "e";
  if (v === "se") return "SE";
  return null;
}

function detectIphone(text: string): { generation: string | null; variant: string | null } {
  let generation: string | null = null;

  // "iphone15promax", "iphone 15 pro max", "ip15pro"
  const attached = text.match(/iphone\s*(1[2-9]|2[0-2])\s*(pro\s*max|promax|pro|plus|mini|e|se)?/i);
  if (attached) {
    generation = attached[1];
  }

  if (!generation) {
    const spaced = text.match(/\b(1[2-9]|2[0-2])\s*(pro\s*max|promax|pro|plus|mini)?\b/i);
    if (spaced && /\b(iphone|iph|apple|15promax|16promax)\b/i.test(text)) generation = spaced[1];
  }

  let variant: string | null = null;
  const lower = text.toLowerCase();
  if (/pro\s*max|promax|pro max/.test(lower)) variant = "Pro Max";
  else if (/\bpro\b/.test(lower)) variant = "Pro";
  else if (/\bplus\b/.test(lower)) variant = "Plus";
  else if (/\bmini\b/.test(lower)) variant = "mini";
  else if (generation && new RegExp(`iphone\\s*${generation}e\\b`, "i").test(text)) variant = "e";

  // Standalone "15 pro max"-style titles without the word "iphone"
  if (!generation) {
    const m = text.match(/\b(1[3-9])\s*(pro\s*max|pro|plus|mini)\b/i);
    if (m && !/\b(macbook|mba|mbp|air|pro m[1-5])\b/i.test(text)) {
      generation = m[1];
      variant = normalizeVariant(m[2]);
    }
  }

  if (variant) variant = normalizeVariant(variant);
  if (!variant) {
    const e = text.match(new RegExp(`iphone\\s*(?:1[2-9])e\\b`, "i"));
    if (e) variant = "e";
  }

  return { generation, variant };
}

function detectMac(text: string): {
  family: "MacBook Air" | "MacBook Pro" | null;
  chip: string | null;
  screen: string | null;
  ram: number | null;
  storage: number | null;
} {
  const lower = text.toLowerCase();
  let family: "MacBook Air" | "MacBook Pro" | null = null;
  if (/\bmba\b|macbook\s*air|mac\s*air|\bair\b.*\bm[1-5]\b/.test(lower)) family = "MacBook Air";
  else if (/\bmbp\b|macbook\s*pro|mac\s*pro\b|\bpro\b.*\bm[1-5]\b/.test(lower)) family = "MacBook Pro";
  else if (/macbook|apple silicon|\bm[1-5]\b/.test(lower)) family = "MacBook Pro";

  // Chip: "m2 pro", "m1max", "m3 pro", "m4"
  let chip: string | null = null;
  const chipMatch = text.match(/\bm\s*([1-9])\s*(pro|max|ultra)?\b/i);
  if (chipMatch) {
    const suffix = chipMatch[2] ? ` ${chipMatch[2].toLowerCase()}` : "";
    chip = `M${chipMatch[1]}${suffix}`;
    if (family === "MacBook Air" && suffix) {
      // Air never shipped with Pro/Max suffixes - the title is probably wrong.
      chip = `M${chipMatch[1]}`;
    }
  }

  // Screen size with a unit, or a plausible standalone dimension.
  let screen: string | null = null;
  const unitScreen = text.match(/\b(1[1-9])(?:[.,]\d)?\s*(inch|inches|\"|tommer|tommers|")\b/i);
  if (unitScreen) screen = `${unitScreen[1]}-inch`;
  else {
    const standalone = text.match(/\b(13|14|15|16)\b/);
    if (standalone && !/\b\d+\s*\//.test(text)) screen = `${standalone[1]}-inch`;
  }

  // "16/512", "16gb/512gb", "16 / 1tb"
  let ram: number | null = null;
  let storage: number | null = null;
  const slash = text.match(/(\d{1,3})\s*\/\s*(\d{1,4})\s*(tb|t|gb)?\b/i);
  if (slash) {
    const left = Number.parseInt(slash[1], 10);
    if (left >= 4 && left <= 128) ram = left;
    const rightNum = Number.parseInt(slash[2], 10);
    const unit = slash[3]?.toLowerCase();
    if (unit === "tb" || unit === "t") storage = rightNum * 1024;
    else if (rightNum >= 64 && rightNum <= 4096) storage = rightNum;
    else if (unit === "gb") storage = rightNum >= 64 ? rightNum : null;
  }

  if (ram === null) {
    const ramMatch = text.match(/(\d{1,3})\s*gb\s*(ram|memory|unified)?/i) ?? text.match(/\bram\s*(\d{1,3})\s*gb/i);
    if (ramMatch) {
      const n = Number.parseInt(ramMatch[1] ?? ramMatch[0], 10);
      if (n >= 4 && n <= 128) ram = n;
    }
    if (ram === null) {
      const anyGb = parseRam(text);
      if (anyGb && anyGb <= 128 && storage !== anyGb) ram = anyGb;
    }
  }

  if (storage === null) storage = findStorage(text, ram ? [ram] : []);

  return { family, chip, screen, ram, storage };
}

function buildSpecKey(productType: ProductType, canonicalKey: string, parts: (string | number | null)[]): string {
  return [canonicalKey, ...parts.map((p) => (p === null || p === "" ? "na" : String(p)))].join("|");
}

export interface ParseInput {
  title: string;
  description?: string;
}

/**
 * Deterministic product parser. No network, no LLM.
 * Returns a structured product plus a confidence score; `ambiguous` marks
 * records where a required attribute (storage / chip / generation) is missing.
 */
export function parseProduct(input: ParseInput): ParsedProduct {
  const rawTitle = input.title ?? "";
  const description = input.description ?? "";
  const titleText = normalizeText(rawTitle);
  const fullText = normalizeText(`${rawTitle} ${description}`);
  const text = titleText.length > 8 ? titleText : fullText;

  let productType: ProductType = "other";
  let generation: string | null = null;
  let variant: string | null = null;
  let model = "";
  let storageGb: number | null = null;
  let ramGb: number | null = null;
  let chip: string | null = null;
  let screen: string | null = null;
  let year: number | null = null;
  const matchedTerms: string[] = [];

  const isMacLike =
    /\b(macbook|mac\s*book|mba|mbp|mac\s*air|mac\s*pro)\b/i.test(text) ||
    (/\bm\s*[1-9]\b/i.test(text) && /\b(air|pro|silicon)\b/i.test(text));

  if (isMacLike || (/\bm\s*[1-5]\b/i.test(text) && /\b(13|14|15|16|ram|ssd|ssd)\b/i.test(text))) {
    productType = "macbook";
    const mac = detectMac(fullText);
    model = mac.family ?? "MacBook";
    storageGb = mac.storage;
    ramGb = mac.ram;
    chip = mac.chip;
    screen = mac.screen;
    variant = mac.family === "MacBook Pro" ? "Pro" : mac.family === "MacBook Air" ? "Air" : null;
    matchedTerms.push(...(mac.family ? [mac.family] : []), ...(chip ? [chip] : []));
    if (chip) {
      const yearMap: Record<string, number> = {
        M1: 2020, M2: 2022, M3: 2023, M4: 2024, M5: 2025, M6: 2026,
      };
      const base = yearMap[chip.slice(0, 2)] ?? null;
      if (base) year = base + (chip.includes("Pro") || chip.includes("Max") ? 0 : 0);
    }
  } else if (/\biphone\b|\biphone\s*\d|\bip\s*hone\b|\biph\s*one\b/i.test(fullText) || /\biphone/i.test(text)) {
    productType = "iphone";
    const ip = detectIphone(fullText);
    generation = ip.generation;
    variant = ip.variant;
    model = generation
      ? `iPhone ${generation}${variant ? ` ${variant}` : ""}`
      : "iPhone";
    matchedTerms.push("iphone", ...(generation ? [`gen ${generation}`] : []), ...(variant ? [variant] : []));
    const known = generation && variant ? `${generation}-${variant.toLowerCase().replace(/\s+/g, "-")}` : null;
    storageGb = findStorage(fullText, known ? [] : generation ? [Number(generation)] : []);
    if (storageGb === null && known) storageGb = null;
    const def = lookupModel(`iphone:${known ?? ""}`);
    if (def?.releaseYear) year = def.releaseYear;
  } else if (/\b(1[2-9])\s*(pro\s*max|promax|pro|plus)\b/i.test(text)) {
    // "15promax 256" without the word iPhone
    productType = "iphone";
    const ip = detectIphone(text);
    generation = ip.generation;
    variant = ip.variant;
    model = generation ? `iPhone ${generation}${variant ? ` ${variant}` : ""}` : "iPhone";
    storageGb = findStorage(fullText, generation ? [Number(generation)] : []);
    matchedTerms.push("iphone (implicit)", ...(generation ? [`gen ${generation}`] : []));
  }

  const condition = detectCondition(fullText) as Condition;
  const color = detectColor(fullText);
  const batteryMatch = fullText.match(/\b(batteri|battery|health)\b[^0-9]{0,12}(\d{2,3})\s*(%|pct|procent)?/i) ?? fullText.match(/(\d{2,3})\s*%/);
  const batteryHealth = batteryMatch ? parseBatteryHealth(batteryMatch[0]) : parseBatteryHealth(fullText);

  // --- canonical keys -------------------------------------------------
  let canonicalKey = "unknown:unknown";
  if (productType === "iphone" && generation) {
    const slug = variant ? variant.toLowerCase().replace(/\s+/g, "-") : null;
    canonicalKey = slug ? `iphone:${generation}-${slug}` : `iphone:${generation}`;
  } else if (productType === "macbook") {
    const familySlug = (model.startsWith("MacBook Air") ? "macbook-air" : "macbook-pro");
    canonicalKey = `${familySlug}:${(chip ?? "unknown").toLowerCase().replace(/\s+/g, "-")}`;
  } else if (productType === "iphone") {
    canonicalKey = "iphone:unknown";
  }

  const def = lookupModel(canonicalKey);
  if (def) {
    if (!year && def.releaseYear) year = def.releaseYear;
    if (def.productType === "macbook" && !model.includes(def.label.split(" ")[1] ?? "")) {
      // keep the model family label but the chip from the catalog label
      if (def.label.startsWith("MacBook")) model = def.label;
    }
  }

  const inScope = isCoreScope(canonicalKey, productType);

  const specKey =
    productType === "macbook"
      ? buildSpecKey(productType, canonicalKey, [screen, ramGb, storageGb, condition])
      : buildSpecKey(productType, canonicalKey, [storageGb, condition]);

  // --- confidence -----------------------------------------------------
  let confidence = 0.25;
  if (productType !== "other") confidence += 0.2;
  if (generation || chip) confidence += 0.2;
  if (storageGb) confidence += 0.15;
  if (condition !== "unknown") confidence += 0.1;
  if (def) confidence += 0.1;
  confidence = Math.min(1, confidence);

  const ambiguous =
    productType === "other" ||
    (productType === "iphone" && !storageGb) ||
    (productType === "macbook" && (!chip || !storageGb)) ||
    confidence < 0.75;

  const known = new Set(tokenize(rawTitle).concat(tokenize(description)));
  const unmatchedTokens = [...known].filter(
    (t) => t.length > 2 && !/iphone|macbook|apple|gb|tb|pro|max|plus|air|m[1-9]|ram|ssd|brugt|ny|stand/i.test(t)
  );

  return {
    brand: productType === "other" ? "unknown" : "Apple",
    productType,
    generation,
    variant,
    model: productType === "other" ? "Ukendt produkt" : model || "Apple produkt",
    storageGb,
    ramGb,
    chip,
    screenSize: screen,
    color,
    year,
    condition,
    batteryHealth,
    canonicalKey,
    specKey,
    confidence: Number(confidence.toFixed(3)),
    ambiguous,
    inScope,
    matchedTerms,
    unmatchedTokens: unmatchedTokens.slice(0, 12),
  };
}

/**
 * Applies authoritative structured fields (CSV/JSON import, provider payloads)
 * on top of the deterministic parser.
 */
export function applyExplicitFields(
  parsed: ParsedProduct,
  explicit: Partial<{
    productType: ProductType;
    model: string;
    generation: string;
    variant: string;
    storageGb: number;
    ramGb: number;
    chip: string;
    screenSize: string;
    color: string;
    year: number;
    condition: Condition;
    batteryHealth: number;
    brand: string;
  }>
): ParsedProduct {
  const next: ParsedProduct = { ...parsed };
  for (const [k, v] of Object.entries(explicit)) {
    if (v !== undefined && v !== null && v !== "") {
      (next as unknown as Record<string, unknown>)[k] = v;
    }
  }
  if (next.productType === "iphone" && next.generation) {
    const slug = next.variant ? next.variant.toLowerCase().replace(/\s+/g, "-") : null;
    next.canonicalKey = slug ? `iphone:${next.generation}-${slug}` : `iphone:${next.generation}`;
  } else if (next.productType === "macbook") {
    const familySlug = next.model.toLowerCase().includes("air") ? "macbook-air" : "macbook-pro";
    next.canonicalKey = `${familySlug}:${(next.chip ?? "unknown").toLowerCase().replace(/\s+/g, "-")}`;
  }
  next.inScope = isCoreScope(next.canonicalKey, next.productType);
  next.specKey =
    next.productType === "macbook"
      ? buildSpecKey(next.productType, next.canonicalKey, [next.screenSize, next.ramGb, next.storageGb, next.condition])
      : buildSpecKey(next.productType, next.canonicalKey, [next.storageGb, next.condition]);
  return next;
}

export function conditionFactor(condition: Condition | string | null | undefined): number {
  switch (condition) {
    case "new":
      return 1.12;
    case "like_new":
      return 1.05;
    case "good":
      return 1;
    case "fair":
      return 0.9;
    case "poor":
      return 0.78;
    default:
      return 1;
  }
}

export function batteryFactor(batteryHealth: number | null | undefined): number {
  if (batteryHealth === null || batteryHealth === undefined) return 1;
  if (batteryHealth >= 90) return 1;
  if (batteryHealth >= 85) return 0.97;
  if (batteryHealth >= 80) return 0.94;
  if (batteryHealth >= 75) return 0.9;
  return 0.84;
}

export function storageDesirability(storageGb: number | null, productType: ProductType): number {
  if (!storageGb) return 0.5;
  if (productType === "iphone") return storageLiquidity(storageGb);
  if (storageGb >= 512) return 0.8;
  if (storageGb >= 256) return 1;
  return 0.6;
}
