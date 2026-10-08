import crypto from "node:crypto";
import { db } from "../db/index";
import { listings } from "../db/schema";
import { eq } from "drizzle-orm";
import type { MarketplaceProvider, ProviderStatus, RawListingRecord, SyncResult } from "./types";
import { parseDkk } from "../core/normalize";

/**
 * Vinted exposes exactly one official integration: **Vinted Pro Integrations**
 * (pro-docs.svc.vinted.com), and it is only available to allow-listed Vinted
 * Pro businesses. There is no public buyer-side catalog API, and Vinted's
 * internal endpoints are protected by anti-bot systems we deliberately do not
 * touch.
 *
 * This adapter implements the official transport (access key + HMAC-SHA256
 * request signing). It stays UNLIMITED until you supply credentials from the
 * Pro Integrations Portal. The endpoint path is configurable because it is
 * defined by your allow-listed integration contract.
 *
 * Env:
 *   VINTED_ACCESS_KEY      - from the Pro Integrations portal
 *   VINTED_SIGNING_KEY     - the signing half of the same token
 *   VINTED_API_BASE        - default https://pro.svc.vinted.com
 *   VINTED_SEARCH_PATH     - default /api/v1/items/search
 *   VINTED_QUERY_PARAM     - default q
 */
function env(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

function isConfigured(): boolean {
  return Boolean(env("VINTED_ACCESS_KEY") && env("VINTED_SIGNING_KEY"));
}

function sign(signingKey: string, timestamp: number, method: string, pathWithQuery: string, body: string): string {
  // Payload layout documented by Vinted Pro Integrations: timestamp, method,
  // request target and body joined by newlines. Confirm against pro-docs if a
  // request is rejected - this is the only place the payload is built.
  const payload = `${timestamp}\n${method.toUpperCase()}\n${pathWithQuery}\n${body}`;
  return crypto.createHmac("sha256", signingKey).update(payload).digest("hex");
}

interface VintedItem {
  id?: string | number;
  title?: string;
  description?: string;
  price?: string | number;
  total_item_price?: string | number;
  amount?: string | number;
  url?: string;
  photo?: { url?: string } | { url?: string }[];
  photo_url?: string;
  location?: string;
  city?: string;
  created_at?: string;
  user?: { login?: string; id?: number };
}

function mapItem(item: VintedItem): RawListingRecord | null {
  const title = item.title ?? item.description?.split("\n")[0];
  if (!title) return null;
  const rawPrice = item.price ?? item.total_item_price ?? item.amount;
  const price = typeof rawPrice === "number" ? Math.round(rawPrice) : parseDkk(String(rawPrice ?? ""));
  if (!price) return null;
  const photo = Array.isArray(item.photo) ? item.photo[0] : item.photo;
  const url = item.url
    ? item.url.startsWith("http")
      ? item.url
      : `https://www.vinted.dk${item.url}`
    : null;
  const postedAt = item.created_at ? Date.parse(item.created_at) : NaN;
  return {
    externalId: item.id ? String(item.id) : null,
    url,
    rawTitle: title,
    description: item.description ?? null,
    priceDkk: price,
    imageUrl: item.photo_url ?? photo?.url ?? null,
    location: item.location ?? item.city ?? null,
    postedAt: Number.isFinite(postedAt) ? postedAt : null,
    sellerHandle: item.user?.login ?? null,
    origin: "REAL",
  };
}

async function callVinted(path: string, init?: RequestInit): Promise<unknown> {
  const base = env("VINTED_API_BASE", "https://pro.svc.vinted.com");
  const accessKey = env("VINTED_ACCESS_KEY");
  const signingKey = env("VINTED_SIGNING_KEY");
  const body = typeof init?.body === "string" ? init.body : "";
  const t = Math.floor(Date.now() / 1000);
  const method = init?.method ?? "GET";
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "X-Vpi-Access-Key": accessKey,
      "X-Vpi-Hmac-Sha256": `t=${t},v1=${sign(signingKey, t, method, path, body)}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vinted svarede ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function search(path: string): Promise<RawListingRecord[]> {
  const json = (await callVinted(path)) as unknown;
  const items = Array.isArray(json)
    ? json
    : ((json as Record<string, unknown>)?.items ??
      (json as Record<string, unknown>)?.data ??
      []);
  if (!Array.isArray(items)) return [];
  return items.map(mapItem).filter((x): x is RawListingRecord => x !== null);
}

export const vintedProvider: MarketplaceProvider = {
  key: "vinted",
  name: "Vinted",

  async getStatus(): Promise<ProviderStatus> {
    const rows = db.select().from(listings).where(eq(listings.marketplaceKey, "vinted")).all();
    const configured = isConfigured();
    return {
      key: "vinted",
      name: "Vinted",
      accessStatus: configured ? "LIMITED" : "UNAVAILABLE",
      accessMode: configured ? "OFFICIEL VINTED PRO API (nøgler sat)" : "MANUEL IMPORT",
      detail: configured
        ? "Officielle Vinted Pro Integrations-nøgler er konfigureret. Status bliver LIVE efter den første vellykkede synkronisering - endpoint-stien afhænger af din allow-listed kontrakt."
        : "Vinted har kun én officiel API (Vinted Pro Integrations), og den kræver en allow-listed Vinted Pro-konto. Uden nøgler er den eneste lovlige vej manuel import eller e-mail-alert-ingestion.",
      requirements: configured
        ? ["Kør 'Synkronisér' og bekræft at svaret er forventet", "Sæt VINTED_SEARCH_PATH hvis din kontrakt bruger en anden sti"]
        : [
            "Ansøg om Vinted Pro + allow-list adgang til Pro Integrations Portal",
            "Generér access token og sæt VINTED_ACCESS_KEY / VINTED_SIGNING_KEY i .env.local",
            "Eller brug e-mail-alert-ingestion / manuel import",
          ],
      enabled: true,
      canSync: configured,
      lastSyncAt: rows.length ? Date.now() : null,
      lastSyncError: null,
      listingCount: rows.length,
      docsUrl: "https://pro-docs.svc.vinted.com/",
    };
  },

  async search(query): Promise<RawListingRecord[]> {
    if (!isConfigured()) throw new Error("Vinted Pro-nøgler er ikke konfigureret");
    const path = env("VINTED_SEARCH_PATH", "/api/v1/items/search");
    const param = env("VINTED_QUERY_PARAM", "q");
    const qs = new URLSearchParams({ [param]: query.text ?? "iphone", page: "1" });
    return search(`${path}?${qs.toString()}`);
  },

  async sync(): Promise<SyncResult> {
    if (!isConfigured()) {
      return { fetched: 0, created: 0, updated: 0, skipped: 0, error: "Vinted Pro-nøgler mangler" };
    }
    try {
      const results = await Promise.all(
        ["iphone 16 pro", "iphone 15 pro", "macbook air m2", "macbook pro m3"].map((t) =>
          search(`${env("VINTED_SEARCH_PATH", "/api/v1/items/search")}?${new URLSearchParams({
            [env("VINTED_QUERY_PARAM", "q")]: t,
            page: "1",
          })}`).catch(() => [])
        )
      );
      const records = results.flat();
      const { ingestBatch } = await import("../db/ingest");
      const res = await ingestBatch(records, "vinted");
      return { fetched: records.length, ...res };
    } catch (err) {
      return {
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
