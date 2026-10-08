/**
 * Polite, single-request fetching used ONLY for user-supplied listing URLs.
 *
 * Rules enforced here:
 *  - one request per user action (no crawling, no pagination, no loops)
 *  - robots.txt is consulted first and cached
 *  - an allow-list of hosts, so a pasted URL can never be used to probe others
 *  - no proxy rotation, no fingerprint spoofing, no CAPTCHA handling
 */

const ALLOWED_HOSTS = new Set([
  "dba.dk",
  "www.dba.dk",
  "guloggratis.dk",
  "www.guloggratis.dk",
  "vinted.dk",
  "www.vinted.dk",
  "vinted.com",
  "www.vinted.com",
]);

const ROBOTS_TTL = 6 * 60 * 60 * 1000;
const robotsCache = new Map<string, { at: number; rules: string[] }>();

const USER_AGENT =
  "ZaksSecondHand/1.0 (local personal deal tracker; single user-supplied URL fetch)";

export interface FetchOutcome {
  ok: boolean;
  html?: string;
  finalUrl?: string;
  reason?: string;
}

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  for (const allowed of ALLOWED_HOSTS) {
    const a = allowed.replace(/^www\./, "");
    if (h === a || h.endsWith(`.${a}`)) return true;
  }
  return false;
}

async function robotsAllows(url: URL): Promise<boolean> {
  const key = url.hostname.replace(/^www\./, "");
  const cached = robotsCache.get(key);
  const now = Date.now();
  let rules: string[] | null = null;
  if (cached && now - cached.at < ROBOTS_TTL) {
    rules = cached.rules;
  } else {
    try {
      const res = await fetch(`https://${url.host}/robots.txt`, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      const text = res.ok ? await res.text() : "";
      rules = text
        .split("\n")
        .filter((l) => /^\s*disallow:/i.test(l))
        .map((l) => l.replace(/^\s*disallow:\s*/i, "").trim());
      robotsCache.set(key, { at: now, rules });
    } catch {
      // If robots.txt cannot be read we do not proceed.
      return false;
    }
  }
  return !rules.some((r) => r && url.pathname.startsWith(r));
}

export async function fetchUserSuppliedPage(rawUrl: string): Promise<FetchOutcome> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, reason: "Ugyldig URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Kun http/https understøttes" };
  }
  if (!isAllowedHost(url.hostname)) {
    return { ok: false, reason: `Domænet ${url.hostname} er ikke på tilladelseslisten` };
  }
  if (!(await robotsAllows(url))) {
    return { ok: false, reason: "robots.txt tillader ikke hentning af denne side" };
  }
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { ok: false, reason: `Svarede ${res.status}` };
    const html = await res.text();
    return { ok: true, html, finalUrl: res.url };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Kunne ikke hente siden" };
  }
}

/** Extracts embedded metadata (JSON-LD / OpenGraph) from a public page. */
export function extractMetadata(html: string): {
  title?: string;
  description?: string;
  image?: string;
  price?: number;
  url?: string;
  location?: string;
  postedAt?: number;
} {
  const out: ReturnType<typeof extractMetadata> = {};

  const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ld) {
    try {
      const parsed = JSON.parse(ld[1]);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const obj = node as Record<string, unknown>;
        if (obj["@type"] === "Product" || obj.offers) {
          if (typeof obj.name === "string") out.title = obj.name;
          if (typeof obj.description === "string") out.description = obj.description;
          const img = obj.image;
          if (typeof img === "string") out.image = img;
          else if (Array.isArray(img) && typeof img[0] === "string") out.image = img[0];
          const offers = obj.offers as Record<string, unknown> | undefined;
          if (offers) {
            const price = Number(offers.price ?? offers.lowPrice);
            if (Number.isFinite(price)) out.price = price;
            if (typeof offers.priceCurrency === "string" && offers.priceCurrency !== "DKK") {
              delete out.price;
            }
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  const og = (prop: string) => {
    const m = html.match(
      new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i")
    );
    return m?.[1];
  };
  const name = (prop: string) => {
    const m = html.match(
      new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")
    );
    return m?.[1];
  };

  out.title = out.title ?? og("title") ?? name("title") ?? undefined;
  out.description = out.description ?? og("description") ?? name("description") ?? undefined;
  out.image = out.image ?? og("image") ?? undefined;
  out.url = og("url") ?? undefined;
  if (out.price === undefined) {
    const priceMeta =
      name("price") ??
      og("product:price:amount") ??
      html.match(/["']price["']\s*:\s*["']?(\d[\d.,]{1,10})/i)?.[1];
    if (priceMeta) {
      const n = Number.parseFloat(String(priceMeta).replace(",", "."));
      if (Number.isFinite(n) && n > 0) out.price = n;
    }
  }
  return out;
}
