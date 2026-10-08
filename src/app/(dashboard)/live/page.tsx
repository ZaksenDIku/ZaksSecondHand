import Link from "next/link";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { queryListings } from "@/lib/db/queries";
import { getAppSettings } from "@/lib/db/settings";
import { DealFeed } from "@/components/domain/deal-feed";
import { PageHeader, OriginLegend } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { SortKey } from "@/lib/core/types";

export const dynamic = "force-dynamic";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "score", label: "Deal score" },
  { value: "discount", label: "Rabat" },
  { value: "profit", label: "Forventet profit" },
  { value: "roi", label: "ROI" },
  { value: "newest", label: "Nyeste først" },
  { value: "price_asc", label: "Laveste pris" },
];

export default async function LivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await ensureBootstrap();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const sort = (one("sort") ?? "score") as SortKey;
  const marketplace = one("marketplace");
  const productType = one("type");
  const origin = one("origin");
  const maxPrice = one("max") ? Number(one("max")) : undefined;
  const minScore = one("min") ? Number(one("min")) : undefined;
  const q = one("q")?.trim();

  const settings = getAppSettings();
  const age = one("age") ? Number(one("age")) : undefined;
  const onlyGems = one("gems") === "1";
  const onlyDrops = one("drops") === "1";

  let rows = queryListings({
    sort,
    marketplaces: marketplace ? [marketplace] : undefined,
    productType,
    origins: origin ? [origin] : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    minDealScore: Number.isFinite(minScore) ? minScore : undefined,
    maxAgeMinutes: Number.isFinite(age) ? age : undefined,
    q,
    limit: 300,
  });
  // These depend on fields the deal engine derives, so they filter afterwards.
  if (onlyGems) rows = rows.filter((r) => r.hiddenGemScore >= 35);
  if (onlyDrops) rows = rows.filter((r) => r.priceChangedFrom !== null && r.priceChangedFrom > r.priceDkk);

  const qp = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      sort,
      marketplace,
      type: productType,
      origin,
      max: one("max"),
      min: one("min"),
      age: one("age"),
      gems: one("gems"),
      drops: one("drops"),
      q,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/live?${s}` : "/live";
  };

  const counts = {
    all: queryListings({ limit: 500 }).length,
    iphone: queryListings({ productType: "iphone", limit: 500 }).length,
    macbook: queryListings({ productType: "macbook", limit: 500 }).length,
    real: queryListings({ origins: ["REAL"], limit: 500 }).length,
    imported: queryListings({ origins: ["IMPORTED"], limit: 500 }).length,
    demo: queryListings({ origins: ["DEMO"], limit: 500 }).length,
  };

  return (
    <>
      <PageHeader
        title="Live deals"
        subtitle="Alle opsamlede annoncer, sorteret efter vurdering. Priser og markedsværdier bygger kun på observerede data fra denne database."
        originNote={<OriginLegend />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {[
          { label: "Alle", href: qp({ type: undefined }), active: !productType },
          {
            label: "🚨 Urgent",
            href: qp({ min: "93" }),
            active: minScore !== undefined && minScore >= 93,
          },
          { label: "⚡ Sidste time", href: qp({ age: "60" }), active: age !== undefined },
          { label: "💎 Hidden gems", href: qp({ gems: "1" }), active: onlyGems },
          { label: "📉 Prisfald", href: qp({ drops: "1" }), active: onlyDrops },
          { label: `iPhone (${counts.iphone})`, href: qp({ type: "iphone" }), active: productType === "iphone" },
          { label: `MacBook (${counts.macbook})`, href: qp({ type: "macbook" }), active: productType === "macbook" },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
              t.active
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-line bg-panel text-muted hover:border-line-2 hover:text-ink"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-[13px]">
            {rows.length} annonce{rows.length === 1 ? "" : "r"}
            {settings.demo.enabled && (
              <span className="ml-2 text-[11px] font-normal text-demo">inkl. DEMO</span>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex flex-wrap items-center gap-2">
              {productType && <input type="hidden" name="type" value={productType} />}
              {origin && <input type="hidden" name="origin" value={origin} />}
              {marketplace && <input type="hidden" name="marketplace" value={marketplace} />}
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Søg model…"
                className="h-7 w-32 rounded-md border border-line bg-panel-2 px-2 text-[12px] text-ink outline-none placeholder:text-dim focus:border-line-2"
              />
              <Select name="marketplace" defaultValue={marketplace ?? ""} className="h-7 w-32 text-[12px]">
                <option value="">Alle kilder</option>
                {["dba", "facebook", "vinted", "manual", "email", "demo"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select name="origin" defaultValue={origin ?? ""} className="h-7 w-28 text-[12px]">
                <option value="">Alle data</option>
                <option value="REAL">REAL</option>
                <option value="IMPORTED">IMPORTED</option>
                <option value="DEMO">DEMO</option>
                <option value="STALE">STALE</option>
              </Select>
              <input
                name="max"
                type="number"
                min={0}
                step={250}
                defaultValue={one("max") ?? ""}
                placeholder="Max kr"
                className="h-7 w-24 rounded-md border border-line bg-panel-2 px-2 text-[12px] text-ink outline-none placeholder:text-dim focus:border-line-2"
              />
              <input
                name="min"
                type="number"
                min={0}
                max={100}
                defaultValue={one("min") ?? ""}
                placeholder="Min score"
                className="h-7 w-20 rounded-md border border-line bg-panel-2 px-2 text-[12px] text-ink outline-none placeholder:text-dim focus:border-line-2"
              />
              <button
                type="submit"
                className="h-7 rounded-md border border-line bg-panel-2 px-2.5 text-[12px] text-ink transition-colors hover:border-line-2"
              >
                Filtrér
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DealFeed
            rows={rows}
            initialSort={sort}
            emptyTitle="Ingen annoncer matcher filteret"
            emptyDescription="Justér filtret, eller hent flere data via Import."
            emptyHref="/import"
            emptyAction="Åbn import"
          />
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-dim">
        Sorter ({SORTS.find((s) => s.value === sort)?.label ?? "Deal score"}) foretages i browseren på de viste rækker.{" "}
        <Link href="/settings" className="text-muted underline underline-offset-2">
          Justér vægtningen
        </Link>{" "}
        hvis rækkefølgen ikke passer dine kriterier.
      </p>
    </>
  );
}
