import { ensureBootstrap } from "@/lib/db/bootstrap";
import { queryListings } from "@/lib/db/queries";
import { DealFeed } from "@/components/domain/deal-feed";
import { PageHeader, OriginLegend } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDkk } from "@/lib/core/format";
import type { ListingView } from "@/lib/view-types";

export const dynamic = "force-dynamic";

/** Shared implementation for /iphones and /macbooks. */
export async function ProductView({
  productType,
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  sort,
}: {
  productType: "iphone" | "macbook";
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  sort: "score" | "discount" | "profit" | "newest" | "price_asc" | "roi";
}) {
  await ensureBootstrap();
  const rows = queryListings({ productType, sort, limit: 300 });

  const groups = groupByModel(rows);

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} originNote={<OriginLegend />} />

      {groups.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {groups.slice(0, 12).map((g) => (
            <Card key={g.key} className="p-3">
              <div className="truncate text-[12.5px] font-medium text-ink">{g.label}</div>
              <div className="mono mt-1 text-[11px] text-dim">{g.count} fund</div>
              <div className="mono mt-2 flex items-baseline justify-between">
                <span className="text-[11px] text-dim">fra</span>
                <span className="text-[13px] font-semibold text-accent">{formatDkk(g.minPrice)}</span>
              </div>
              <div className="mono mt-1 flex items-baseline justify-between">
                <span className="text-[11px] text-dim">median</span>
                <span className="text-[12px] text-ink">{formatDkk(g.median)}</span>
              </div>
              <div className="mono mt-1 flex items-baseline justify-between">
                <span className="text-[11px] text-dim">top score</span>
                <span className="text-[12px] text-good">{g.bestScore}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">{rows.length} announcementer</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DealFeed
            rows={rows}
            initialSort={sort}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            emptyHref="/import"
            emptyAction="Åbn import"
          />
        </CardContent>
      </Card>
    </>
  );
}

function groupByModel(rows: ListingView[]) {
  const map = new Map<string, { key: string; label: string; prices: number[]; bestScore: number }>();
  for (const r of rows) {
    const key = r.canonicalKey ?? r.title;
    const cur = map.get(key) ?? { key, label: r.title, prices: [], bestScore: 0 };
    cur.prices.push(r.priceDkk);
    cur.bestScore = Math.max(cur.bestScore, r.dealScore);
    map.set(key, cur);
  }
  return [...map.values()]
    .map((g) => {
      const sorted = [...g.prices].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
      return { ...g, count: g.prices.length, minPrice: sorted[0] ?? 0, median: mid };
    })
    .sort((a, b) => b.bestScore - a.bestScore || b.count - a.count);
}
