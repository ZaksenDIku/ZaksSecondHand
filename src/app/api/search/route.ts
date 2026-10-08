import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { queryListings } from "@/lib/db/queries";
import { getWatchRules } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** Backs the global command palette. Plain JSON, no cache. */
export async function GET(req: Request) {
  await ensureBootstrap();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const lower = q.toLowerCase();
  const needles = lower.split(/\s+/).filter(Boolean);
  const matches = (haystack: string) => needles.every((n) => haystack.toLowerCase().includes(n));

  const results = queryListings({ limit: 400 })
    .filter((l) => matches(`${l.title} ${l.marketplaceKey} ${l.canonicalKey ?? ""} ${l.location ?? ""}`))
    .slice(0, 12)
    .map((l) => ({
      type: "listing" as const,
      id: l.id,
      title: l.title,
      subtitle: `${l.marketplaceKey} · ${l.priceDkk} kr · score ${l.dealScore}`,
      href: `/listings/${l.id}`,
    }));

  const pages = [
    { title: "Live deals", href: "/live", hint: "Alle opsamlede annoncer" },
    { title: "iPhones", href: "/iphones", hint: "iPhone 15+" },
    { title: "MacBooks", href: "/macbooks", hint: "Apple Silicon M1+" },
    { title: "Watchlist", href: "/watchlist", hint: "Regler og gemte fund" },
    { title: "Heatmap", href: "/heatmap", hint: "Model × lager" },
    { title: "Flips", href: "/flips", hint: "ROI og portefølje" },
    { title: "Import", href: "/import", hint: "URL, tekst, CSV, JSON, e-mail" },
    { title: "Datakilder", href: "/sources", hint: "Provider-status" },
    { title: "Analytics", href: "/analytics", hint: "Resultater og ROI" },
    { title: "Indstillinger", href: "/settings", hint: "Vægtning, kilder, notifikationer" },
  ]
    .filter((p) => matches(`${p.title} ${p.hint}`))
    .slice(0, 6)
    .map((p) => ({ type: "page" as const, id: p.href, title: p.title, subtitle: p.hint, href: p.href }));

  const rules = getWatchRules()
    .filter((r) => matches(r.label))
    .slice(0, 4)
    .map((r) => ({
      type: "watch" as const,
      id: r.id,
      title: r.label,
      subtitle: r.enabled ? "Aktiv watch-regel" : "Deaktiveret regel",
      href: "/watchlist",
    }));

  return NextResponse.json({ results: [...pages, ...results, ...rules] });
}
