import type { RawListingRecord } from "./providers/types";
import { parseDkk, parseRelativeTime, parseDate, parseStorage, parseRam, parseBatteryHealth } from "./core/normalize";

/** Minimal RFC4180-ish CSV reader (handles quotes, escaped quotes, CRLF). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = lower.findIndex((h) => h === name || h.includes(name));
    if (idx >= 0) return idx;
  }
  return -1;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number.parseInt(v.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};

export interface ImportResult {
  records: RawListingRecord[];
  errors: string[];
  skipped: number;
}

export function recordsFromCsv(text: string, defaultMarketplace = "manual"): ImportResult {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return { records: [], errors: ["CSV mangler en header-række og mindst én data-række"], skipped: 0 };

  const headers = rows[0];
  const iTitle = headerIndex(headers, "title", "titel", "overskrift", "name");
  const iPrice = headerIndex(headers, "price", "pris");
  const iUrl = headerIndex(headers, "url", "link");
  const iDesc = headerIndex(headers, "description", "beskrivelse", "text");
  const iImage = headerIndex(headers, "image", "billede", "imageurl");
  const iLoc = headerIndex(headers, "location", "sted", "by", "postnr");
  const iPosted = headerIndex(headers, "posted", "dato", "date", "oprettet", "published");
  const iExt = headerIndex(headers, "id", "externalid", "annonceid");
  const iSeller = headerIndex(headers, "seller", "sælger", "saelger", "username");
  const iMarket = headerIndex(headers, "marketplace", "marked", "platform");
  const iStorage = headerIndex(headers, "storage", "lager");
  const iRam = headerIndex(headers, "ram");
  const iChip = headerIndex(headers, "chip");
  const iCondition = headerIndex(headers, "condition", "stand");
  const iBattery = headerIndex(headers, "battery", "batteri");

  if (iTitle < 0 || iPrice < 0) {
    return { records: [], errors: ["CSV skal som minimum have kolonnerne 'title' og 'price'"], skipped: 0 };
  }

  const records: RawListingRecord[] = [];
  const errors: string[] = [];
  let skipped = 0;

  rows.slice(1).forEach((cols, idx) => {
    const title = (cols[iTitle] ?? "").trim();
    const price = parseDkk(cols[iPrice] ?? "");
    if (!title || !price) {
      skipped++;
      if (errors.length < 10) errors.push(`Række ${idx + 2}: mangler titel eller gyldig pris`);
      return;
    }

    const postedRaw = iPosted >= 0 ? cols[iPosted] : undefined;
    const postedAt = postedRaw ? (parseRelativeTime(postedRaw) ?? parseDate(postedRaw)) : null;

    const explicit: Record<string, string | number | null> = {};
    if (iStorage >= 0) {
      const s = parseStorage(cols[iStorage]) ?? num(cols[iStorage]);
      if (s) explicit.storageGb = s;
    }
    if (iRam >= 0) {
      const r = parseRam(cols[iRam]) ?? num(cols[iRam]);
      if (r) explicit.ramGb = r;
    }
    if (iChip >= 0 && cols[iChip]?.trim()) explicit.chip = cols[iChip].trim();
    if (iCondition >= 0 && cols[iCondition]?.trim()) {
      const c = cols[iCondition].trim().toLowerCase();
      if (["new", "like_new", "good", "fair", "poor", "unknown"].includes(c)) {
        explicit.condition = c;
      }
    }
    if (iBattery >= 0) {
      const b = parseBatteryHealth(`${cols[iBattery]}%`) ?? num(cols[iBattery]);
      if (b && b > 50) explicit.batteryHealth = b;
    }

    const rowMarket =
      (iMarket >= 0 ? cols[iMarket]?.trim() : "") || defaultMarketplace || null;

    records.push({
      marketplaceKey: rowMarket ? rowMarket.toLowerCase() : null,
      externalId: iExt >= 0 ? cols[iExt]?.trim() || null : null,
      url: iUrl >= 0 ? cols[iUrl]?.trim() || null : null,
      rawTitle: title,
      description: iDesc >= 0 ? cols[iDesc] ?? "" : "",
      priceDkk: price,
      imageUrl: iImage >= 0 ? cols[iImage]?.trim() || null : null,
      location: iLoc >= 0 ? cols[iLoc]?.trim() || null : null,
      postedAt,
      sellerHandle: iSeller >= 0 ? cols[iSeller]?.trim() || null : null,
      origin: "IMPORTED",
      explicit,
    });
  });

  return { records, errors, skipped };
}

export function recordsFromJson(text: string): ImportResult {
  try {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { listings?: unknown[] }).listings)
        ? (parsed as { listings: unknown[] }).listings
        : null;
    if (!list) return { records: [], errors: ["JSON skal være et array eller have feltet 'listings'"], skipped: 0 };

    const records: RawListingRecord[] = [];
    const errors: string[] = [];
    let skipped = 0;

    list.forEach((item, idx) => {
      const o = item as Record<string, unknown>;
      const title = String(o.title ?? o.rawTitle ?? o.name ?? "").trim();
      const price = parseDkk(String(o.price ?? o.priceDkk ?? o.pris ?? ""));
      if (!title || !price) {
        skipped++;
        if (errors.length < 10) errors.push(`Element ${idx + 1}: mangler title/pris`);
        return;
      }
      const postedRaw: unknown = o.postedAt ?? o.date ?? o.createdAt;
      const postedAt: number | null = (() => {
        if (postedRaw === null || postedRaw === undefined || postedRaw === "") return null;
        if (typeof postedRaw === "number") return postedRaw > 1e12 ? postedRaw : postedRaw * 1000;
        return parseRelativeTime(String(postedRaw)) ?? parseDate(String(postedRaw));
      })();
      records.push({
        externalId: o.externalId ? String(o.externalId) : null,
        url: o.url ? String(o.url) : null,
        rawTitle: title,
        description: String(o.description ?? ""),
        priceDkk: price,
        imageUrl: o.imageUrl ?? o.image ? String(o.imageUrl ?? o.image) : null,
        location: o.location ? String(o.location) : null,
        postedAt,
        sellerHandle: o.seller ? String(o.seller) : null,
        origin: "IMPORTED",
      });
    });

    return { records, errors, skipped };
  } catch (err) {
    return { records: [], errors: [err instanceof Error ? err.message : "Ugyldig JSON"], skipped: 0 };
  }
}
