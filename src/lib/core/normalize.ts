/**
 * Text and price normalization helpers shared by every provider adapter.
 * Marketplace titles arrive in wildly different shapes; the goal is to make
 * them comparable without losing the original string.
 */

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Lowercase, de-accent, replace separators with spaces. */
export function normalizeText(input: string): string {
  return collapseWhitespace(
    stripDiacritics(input.toLowerCase())
      .replace(/[/|,;:()]+/g, " ")
      .replace(/[_\-.]+/g, " ")
  );
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Parses a Danish/English money string into an integer DKK amount.
 *   "4.200 kr"      -> 4200
 *   "1.999,00 kr."  -> 1999
 *   "4,200 DKK"     -> 4200
 *   "3800"          -> 3800
 */
export function parseDkk(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.round(raw) : null;
  }
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return null;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    // The right-most separator is the decimal separator.
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    const decimals = parts[parts.length - 1];
    if (decimals.length === 3 && parts.length > 1 && /^\d{3}$/.test(decimals)) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(",", ".");
    }
  } else if (hasDot) {
    const parts = s.split(".");
    const last = parts[parts.length - 1];
    // "4.200" is Danish thousands, "4.2" is a decimal.
    if (last.length === 3 && parts.length > 1 && /^\d{3}$/.test(last) && parts[0].length <= 3) {
      s = s.replace(/\./g, "");
    } else if (parts.length > 2) {
      s = s.replace(/\./g, "");
    }
  }

  const value = Number.parseFloat(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

/** "256gb", "512 GB", "1 tb", "256 gb." -> 256 | 1024 */
export function parseStorage(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .match(/(\d+(?:[.,]\d+)?)\s*(tb|t|gb|g)$/);
  if (!m) return null;
  let n = Number.parseFloat(m[1].replace(",", "."));
  const unit = m[2];
  if (unit === "tb" || unit === "t") n *= 1024;
  if (!Number.isFinite(n) || n <= 0 || n > 4096) return null;
  return Math.round(n);
}

/** "16gb", "16 gb ram", "16/512" (leading number) */
export function parseRam(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .match(/(\d{1,4})\s*(gb|g)(?!b)/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 2 || n > 128) return null;
  return n;
}

/** Battery health: "91%", "batteri 87 procent", "87%" */
export function parseBatteryHealth(raw: string): number | null {
  const m = raw
    .toLowerCase()
    .replace(",", ".")
    .match(/(\d{2,3})\s*(?:%|pct|procent)/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  if (n < 50 || n > 100) return null;
  return n;
}

const DATE_PATTERNS: Array<[RegExp, (d: RegExpMatchArray) => number | null]> = [
  // "2024-05-04", "2024/05/04"
  [/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, (d) => Date.UTC(+d[1], +d[2] - 1, +d[3])],
  // "4. maj 2024" / "4 maj 2024"
  [/(\d{1,2})\.\s*(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)[a-z]*\.?\s*(\d{4})/i, (d) => {
    const months = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
    return Date.UTC(+d[3], months.indexOf(d[2].toLowerCase()), +d[1]);
  }],
  // "maj 4, 2024"
  [/([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i, (d) => {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const idx = months.indexOf(d[1].toLowerCase());
    return idx >= 0 ? Date.UTC(+d[3], idx, +d[2]) : null;
  }],
];

export function parseDate(raw: string | null | undefined): number | null {
  if (!raw) return null;
  for (const [re, build] of DATE_PATTERNS) {
    const m = raw.match(re);
    if (m) {
      const t = build(m);
      if (t && Number.isFinite(t)) return t;
    }
  }
  const fallback = Date.parse(raw);
  return Number.isFinite(fallback) ? fallback : null;
}

const RELATIVE: Array<[RegExp, number]> = [
  [/\b(\d+)\s*(min|m|minut|minutter)\b/i, 1],
  [/\b(\d+)\s*(t|time|timer)\b/i, 60],
  [/\b(\d+)\s*(dag|dage|day|days)\b/i, 1440],
  [/\b(\d+)\s*(uge|uger|week|weeks)\b/i, 10080],
  [/\b(\d+)\s*(mds?|md|maaned|maaneder|month|months)\b/i, 43200],
];

/** "3 min siden", "2 dage siden" -> epoch ms (relative to `now`) */
export function parseRelativeTime(raw: string | null | undefined, now = Date.now()): number | null {
  if (!raw) return null;
  if (/\b(lige nu|now|just now)\b/i.test(raw)) return now;
  for (const [re, minutes] of RELATIVE) {
    const m = raw.match(re);
    if (m) return now - Number.parseInt(m[1], 10) * minutes * 60000;
  }
  return null;
}

/** Extract the first plausible price-looking number from free text. */
export function extractPrice(raw: string): number | null {
  const m = raw.match(/(\d[\d., ]{2,12}\s*(?:kr|dkk|d\.kr\.?)\.?)/i);
  if (m) return parseDkk(m[1]);
  const bare = raw.match(/\b(\d{3,6})\b/);
  return bare ? Number.parseInt(bare[1], 10) : null;
}

/** Dice coefficient over token sets — used by duplicate detection. */
export function titleSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of ta) counts.set(t, (counts.get(t) ?? 0) + 1);
  let matches = 0;
  for (const t of tb) {
    const c = counts.get(t) ?? 0;
    if (c > 0) {
      matches++;
      counts.set(t, c - 1);
    }
  }
  return (2 * matches) / (ta.length + tb.length);
}

export function slugify(input: string): string {
  return normalizeText(input).replace(/\s+/g, "-");
}
