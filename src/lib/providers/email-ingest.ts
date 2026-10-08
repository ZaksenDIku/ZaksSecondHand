import type { MarketplaceProvider, ProviderStatus, RawListingRecord } from "./types";

/**
 * Email / search-alert ingestion.
 *
 * Most marketplaces let you create saved searches that email you new results.
 * Forwarding (or pasting) one of those alerts here turns an allowed, user
 * initiated notification into a structured listing record.
 */

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;
const PRICE_RE = /(?:kr\.?|dkk|d\.kr\.)\s*([0-9][0-9.,]{2,9})|([0-9][0-9.,]{2,9})\s*(?:kr\.?|dkk)/i;

function detectMarketplace(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("dba.dk") || u.includes("guloggratis")) return "dba";
  if (u.includes("facebook") || u.includes("fb.com")) return "facebook";
  if (u.includes("vinted")) return "vinted";
  if (u.includes("trendsales")) return "trendsales";
  return "manual";
}

function priceNear(text: string, index: number): number | null {
  const window = text.slice(Math.max(0, index - 400), Math.min(text.length, index + 400));
  const m = window.match(PRICE_RE);
  if (!m) return null;
  const raw = (m[1] ?? m[2] ?? "").trim();
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Handle "4.200" written with a thousands dot but a decimal-looking comma.
  return n > 100000 ? Math.round(n / 100) : Math.round(n);
}

function titleNear(text: string, index: number): string {
  const before = text.slice(Math.max(0, index - 300), index);
  const lines = before
    .split(/\n|<br\s*\/?>/i)
    .map((l) => l.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const candidate = [...lines].reverse().find((l) => l.length > 4 && l.length < 160);
  return candidate ?? "Importeret annonce";
}

function stripHtml(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function parseAlertText(raw: string): RawListingRecord[] {
  const text = stripHtml(raw);
  if (!text) return [];
  const urls = [...text.matchAll(URL_RE)].map((m) => ({
    url: m[0].replace(/[.,;]+$/, ""),
    index: m.index ?? 0,
  }));

  if (urls.length > 0) {
    const out: RawListingRecord[] = [];
    urls.forEach(({ url, index }, i) => {
      const price = priceNear(text, index) ?? priceNear(text, Math.max(0, index - 400));
      if (!price) return;
      const title = titleNear(text, index) || `Annonce ${i + 1}`;
      out.push({
        marketplaceKey: detectMarketplace(url),
        externalId: url.match(/\/(\d{5,15})(?:[/?#]|$)/)?.[1] ?? null,
        url,
        rawTitle: title,
        description: text.slice(Math.max(0, index - 200), Math.min(text.length, index + 300)).trim(),
        priceDkk: price,
        origin: "IMPORTED",
      });
    });
    return out;
  }

  // No URL: treat the whole paste as a single listing.
  const price = priceNear(text, 0) ?? priceNear(text, Math.floor(text.length / 2));
  const firstLine =
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 3 && l.length < 160) ?? "Importeret annonce";
  if (!price) return [];
  return [
    {
      externalId: null,
      url: null,
      rawTitle: firstLine,
      description: text.slice(0, 4000),
      priceDkk: price,
      origin: "IMPORTED",
    },
  ];
}

export const emailIngestProvider: MarketplaceProvider = {
  key: "email",
  name: "E-mail-alert ingestion",

  async getStatus(): Promise<ProviderStatus> {
    return {
      key: "email",
      name: "E-mail-alert ingestion",
      accessStatus: "MANUAL",
      accessMode: "ALERT INGESTION",
      detail:
        "Videresend en søgnings-alert fra DBA, Facebook eller Vinted, så bliver den normaliseret præcis som alle andre annoncer. Kræver ingen adgang til platformens API.",
      requirements: [
        "Opret en gemt søgning på markedet",
        "Kopiér e-mailens indhold og indsæt den her",
      ],
      enabled: true,
      canSync: false,
      lastSyncAt: null,
      lastSyncError: null,
      listingCount: 0,
    };
  },
};
