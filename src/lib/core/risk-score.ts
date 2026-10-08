import type { RiskLevel, RiskResult, RiskSignalResult } from "./types";
import { normalizeText, titleSimilarity } from "./normalize";

interface PhraseRule {
  code: string;
  pattern: RegExp;
  weight: number;
  severity: RiskSignalResult["severity"];
  detail: string;
}

/**
 * Phrases that indicate the device may be unusable, locked, incomplete or the
 * deal itself may be structured unusually. These are INDICATORS, never a
 * judgement about the seller.
 */
/**
 * "Find My" needs two distinct patterns: one for "it is still on" (a blocker)
 * and one for "it has been turned off" (a trust signal). One alternation cannot
 * express that reliably, because "Find My sl\u00e5et fra" and "Find My stadig
 * aktiv" share the same leading words.
 */
const FIND_MY_OFF = /\bfind my\b(?:(?!\b(?:aktiv|active|on|forkert|stadig|endnu|fortsat|tilkoblet)\b)[^.]*?\b(?:sl\u00e5et (?:helt )?(?:fra|af)|deaktivert|off)\b)/i;
const FIND_MY_STILL_ON = /\bfind my\b(?![^.]{0,40}?\bsl\u00e5et\b[^.]{0,20}?\bfra\b)(?=[^.]{0,40}?\b(?:aktiv|active|on|forkert|tilkoblet|stadig|endnu|fortsat|kan ikke|l\u00e5st))\b/i;

const PHRASE_RULES: PhraseRule[] = [
  { code: "ICLOUD_LOCK", pattern: /\b(icloud locked|icloud l[\u00e5\u00e6]st|aktiveringsl[\u00e5\u00e6]st|activation lock|(?:l[æeåa]st|laest) til (?:en\s+)?(?:anden|andet|mit|min)|find my (?:iphone|mac|ipad)? ?(?:er )?(?:stadig |endnu |fortsat |ikke )?(?:active|aktiv|on|forkert))\b/i, weight: 30, severity: "high", detail: "Enheden kan v\u00e6re l\u00e5st til en anden Apple-ID-konto" },
  { code: "FIND_MY_ON", pattern: FIND_MY_STILL_ON, weight: 30, severity: "high", detail: "Find My er stadig aktiv \u2014 enheden kan v\u00e6re l\u00e5st til en anden Apple-ID-konto" },
  { code: "FIND_MY_OFF", pattern: FIND_MY_OFF, weight: -10, severity: "low", detail: "Find My er angivet som sl\u00e5et fra" },
  { code: "FORGOTTEN_CODE", pattern: /\b(glemt (kode|adgangskode|kodeord)|forgotten passcode|husker ikke kode)\b/i, weight: 28, severity: "high", detail: "Sælger kender ikke adgangskoden" },
  { code: "MDM", pattern: /\b(mdm|mobile device management|remote management|company managed|firmalåst|corporate)\b/i, weight: 30, severity: "high", detail: "Mulig virksomheds-/MDM-styring" },
  { code: "SIM_LOCK", pattern: /\b(sim ?lock|sim-l[æeåa]st|(?:l[æeåa]st|laest) til (?:udbyder|operatør|carrier|netv[æe]rk|netvaerk)|carrier locked|network locked)\b/i, weight: 22, severity: "high", detail: "SIM-låst til et teleselskab" },
  { code: "UNKNOWN_IMEI", pattern: /\b(ukendt imei|invalid imei|imei ikke kendt|blacklistet|stjålet imei)\b/i, weight: 28, severity: "high", detail: "IMEI-status ukendt eller markeret" },
  { code: "CANNOT_TEST", pattern: /\b(kan ikke testes|ikke testet|not tested|kan ikke t[æeåa]ndes|kan ikke taendes|virker ikke|i stykker|dead|bricked)\b/i, weight: 24, severity: "high", detail: "Produktet er ikke testet eller virker ikke" },
  { code: "PARTS_ONLY", pattern: /\b(reservedel|parts only|til dele|delvis defekt|smashed|knust sk[æea]rm|knust skarm)\b/i, weight: 24, severity: "high", detail: "Sælges muligvis som reservedel" },
  { code: "DEPOSIT_ONLY", pattern: /\b(kun mobilepay depositum|depositum|indenbetaling|forskud|prepayment|betalt p[åa] forh[åa]nd|send ikke penge)\b/i, weight: 26, severity: "high", detail: "Betaling kræves før fremvisning" },
  { code: "NO_RECEIPT", pattern: /\b(ingen kvittering|no receipt|har ikke kvittering|kvittering findes ikke)\b/i, weight: 8, severity: "low", detail: "Ingen kvittering - sværere at dokumentere ejerskab" },
  { code: "NO_CHARGER", pattern: /\b(uden lader|ingen lader|ikke lader|no charger|kun telefonen|kun enheden|kun macbook uden)\b/i, weight: 6, severity: "low", detail: "Tilbehør mangler" },
  { code: "SCREEN_ISSUE", pattern: /\b(sk[æea]rm virker ikke|skarm virker ikke|d[øoeo]de pixels|dode pixels|stribet sk[æea]rm|stribet skarm|cracked screen|revnet sk[æea]rm|revnet skarm|burn ?in|indbr[æea]nding|indbranding)\b/i, weight: 18, severity: "medium", detail: "Skærmen er beskadiget eller fejlbehæftet" },
  { code: "BATTERY_POOR", pattern: /\b(batteri under \d{2}|batteri (meget )?slidt|battery health under \d{2}|batteri skifter snart)\b/i, weight: 10, severity: "medium", detail: "Batteriet er slidt" },
  { code: "LOCK_GENERIC", pattern: /\b(l[æeåa]st|laest|locked|passcode locked)\b/i, weight: 12, severity: "medium", detail: "Enheden er låst" },
  { code: "UNTESTED_NETWORK", pattern: /\b(simlock fri|factory unlocked|sim-free|ul[åa]st)\b/i, weight: -8, severity: "low", detail: "Angivet som ulåst" },
  { code: "HAS_RECEIPT", pattern: /\b(kvittering|faktura|k[øb]t hos|kobt hos|apple store|garanti|receipt|invoice)\b/i, weight: -8, severity: "low", detail: "Kvittering/garanti angivet" },
];

export interface RiskContext {
  title: string;
  description?: string;
  priceDkk?: number | null;
  marketValue?: number | null;
  hasImage?: boolean;
  imageUrl?: string | null;
  hasLocation?: boolean;
  hasStorage?: boolean;
  hasCondition?: boolean;
  sellerTrusted?: boolean | null;
  parsedModel?: string | null;
  titleMentionsModel?: boolean | null;
}

export function detectRisk(ctx: RiskContext): RiskResult {
  const signals: RiskSignalResult[] = [];
  const haystack = `${ctx.title}\n${ctx.description ?? ""}`;
  const text = normalizeText(haystack);

  // Rules run against both the raw text and the normalised text, because
  // `normalizeText` strips diacritics ("læst" -> "last") and sellers write both
  // spellings freely. Testing both means neither form is silently missed.
  for (const rule of PHRASE_RULES) {
    if (rule.pattern.test(haystack) || rule.pattern.test(text)) {
      signals.push({
        code: rule.code,
        phrase: rule.pattern.source.slice(0, 60),
        severity: rule.severity,
        weight: rule.weight,
        detail: rule.detail,
      });
    }
  }

  const desc = (ctx.description ?? "").trim();
  if (desc.length < 20) {
    signals.push({
      code: "EMPTY_DESCRIPTION",
      phrase: null,
      severity: "medium",
      weight: 10,
      detail: "Beskrivelsen mangler eller er meget kort",
    });
  }

  if (!ctx.hasImage && !ctx.imageUrl) {
    signals.push({
      code: "NO_IMAGE",
      phrase: null,
      severity: "medium",
      weight: 8,
      detail: "Ingen billeder på annoncen",
    });
  } else if (ctx.imageUrl && /placeholder|stock|noimage|default|blank/i.test(ctx.imageUrl)) {
    signals.push({
      code: "STOCK_IMAGE",
      phrase: null,
      severity: "medium",
      weight: 12,
      detail: "Billedet ligner et standardlagerbillede",
    });
  }

  if (ctx.hasStorage === false) {
    signals.push({
      code: "MISSING_STORAGE",
      phrase: null,
      severity: "low",
      weight: 6,
      detail: "Lagerkapacitet er ikke angivet",
    });
  }

  if (ctx.titleMentionsModel === false && ctx.parsedModel) {
    signals.push({
      code: "MODEL_MISMATCH",
      phrase: null,
      severity: "medium",
      weight: 14,
      detail: `Titlen beskriver ikke det samme produkt som den normaliserede model (${ctx.parsedModel})`,
    });
  }

  if (
    ctx.priceDkk &&
    ctx.marketValue &&
    ctx.marketValue > 0 &&
    ctx.priceDkk < ctx.marketValue * 0.6
  ) {
    signals.push({
      code: "PRICE_ANOMALY",
      phrase: null,
      severity: "high",
      weight: 20,
      detail: "Prisen er markant under markedsværdien - kontrollér enheden",
    });
  } else if (
    ctx.priceDkk &&
    ctx.marketValue &&
    ctx.marketValue > 0 &&
    ctx.priceDkk < ctx.marketValue * 0.75
  ) {
    signals.push({
      code: "PRICE_LOW",
      phrase: null,
      severity: "medium",
      weight: 10,
      detail: "Prisen er væsentlig under markedsværdien",
    });
  }

  if (ctx.sellerTrusted === false) {
    signals.push({
      code: "SELLER_UNTRUSTED",
      phrase: null,
      severity: "medium",
      weight: 12,
      detail: "Sælger har ingen verificerbar historik på platformen",
    });
  }

  // Cap the negative (trust-building) contribution so it cannot erase real flags.
  let score = 0;
  let positive = 0;
  for (const s of signals) {
    if (s.weight < 0) positive += s.weight;
    else score += s.weight;
  }
  score = Math.max(0, score + Math.max(positive, -20));
  score = Math.min(100, Math.round(score));

  const blocking = signals.some((s) => BLOCKING_RISK_CODES.includes(s.code));

  return {
    score,
    blocking,
    level: levelFor(score, blocking),
    signals: signals.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
  };
}

export function levelFor(score: number, blocking = false): RiskLevel {
  if (blocking) return "AVOID";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "ELEVATED";
  if (score >= 22) return "CHECK";
  return "LOW";
}

/**
 * 🔒 Activation Lock / 🏢 MDM / ⛔ other deal-breakers must never be averaged
 * away. The codes must match the ones `PHRASE_RULES` actually emits, otherwise
 * a locked device is scored as merely "elevated" instead of ⛔ AVOID.
 */
export const BLOCKING_RISK_CODES = [
  "ICLOUD_LOCK",
  "FIND_MY_ON",
  "MDM",
  "UNKNOWN_IMEI",
  "DEPOSIT_ONLY",
  "PARTS_ONLY",
];

export const RISK_META: Record<RiskLevel, { label: string; symbol: string; tone: string }> = {
  LOW: { label: "🟢 LOW", symbol: "🟢", tone: "low" },
  CHECK: { label: "🟡 CHECK", symbol: "🟡", tone: "check" },
  ELEVATED: { label: "🟠 ELEVATED", symbol: "🟠", tone: "elevated" },
  HIGH: { label: "🔴 HIGH", symbol: "🔴", tone: "high" },
  AVOID: { label: "⛔ AVOID", symbol: "⛔", tone: "avoid" },
};

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export interface DuplicateCandidate {
  id: string;
  url?: string | null;
  externalId?: string | null;
  marketplaceKey: string;
  title: string;
  priceDkk: number;
  canonicalKey?: string | null;
  storageGb?: number | null;
  location?: string | null;
  sellerHandle?: string | null;
}

export function normalizeUrlKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "ref", "share"].forEach((p) => u.searchParams.delete(p));
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return null;
  }
}

export interface DuplicateMatch {
  isDuplicate: boolean;
  confidence: number;
  reason: string;
}

export function compareForDuplicate(a: DuplicateCandidate, b: DuplicateCandidate): DuplicateMatch {
  if (a.id && a.id === b.id) return { isDuplicate: true, confidence: 1, reason: "same listing id" };

  const urlA = normalizeUrlKey(a.url);
  const urlB = normalizeUrlKey(b.url);
  if (urlA && urlB && urlA === urlB) return { isDuplicate: true, confidence: 0.99, reason: "same url" };

  if (
    a.externalId &&
    b.externalId &&
    a.marketplaceKey === b.marketplaceKey &&
    a.externalId === b.externalId
  ) {
    return { isDuplicate: true, confidence: 0.98, reason: "same marketplace id" };
  }

  const sim = titleSimilarity(a.title, b.title);
  const priceGap =
    Math.abs(a.priceDkk - b.priceDkk) / Math.max(a.priceDkk, b.priceDkk, 1);
  const sameModel =
    !!a.canonicalKey && a.canonicalKey === b.canonicalKey;
  const sameStorage =
    (a.storageGb ?? null) === (b.storageGb ?? null) && a.storageGb !== null;
  const sameSeller =
    !!a.sellerHandle && !!b.sellerHandle && a.sellerHandle === b.sellerHandle;
  const sameLocation =
    !!a.location && !!b.location && a.location.trim().toLowerCase() === b.location.trim().toLowerCase();

  let score = 0;
  const reasons: string[] = [];
  if (sim >= 0.75) { score += 0.45; reasons.push("title ~"); }
  else if (sim >= 0.55) { score += 0.3; reasons.push("title?"); }
  if (sameModel) { score += 0.2; reasons.push("model"); }
  if (sameStorage) { score += 0.1; reasons.push("storage"); }
  if (priceGap <= 0.03) { score += 0.15; reasons.push("price"); }
  else if (priceGap <= 0.08) { score += 0.07; reasons.push("price?"); }
  if (sameSeller) { score += 0.1; reasons.push("seller"); }
  if (sameLocation) { score += 0.05; reasons.push("location"); }

  const isDuplicate = score >= 0.7;
  return {
    isDuplicate,
    confidence: Number(Math.min(0.97, score).toFixed(2)),
    reason: reasons.join("+") || "no match",
  };
}
