import Link from "next/link";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getHeatmap, getAllListings } from "@/lib/db/queries";
import { HeatmapTable } from "@/components/domain/heatmap-table";
import { PageHeader, OriginLegend } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import {formatDkk, formatPct, formatNumber} from "@/lib/core/format";
import { VELOCITY_META, type VelocityLevel } from "@/lib/core/velocity";
import {OriginBadge, TierBadge} from "@/components/domain/badges";
import { EmptyState } from "@/components/ui/empty-state";
import type { ListingView, HeatmapEntry } from "@/lib/view-types";

export const dynamic = "force-dynamic";

export default async function HeatmapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensureBootstrap();
  const sp = await searchParams;
  const type = typeof sp.type === "string" ? sp.type : "iphone";
  const productType = type === "macbook" ? "macbook" : type === "all" ? undefined : "iphone";
  const entries = getHeatmap(productType);
  const all = getAllListings().filter((l) => !l.ignored && !l.duplicateOf && l.status !== "archived");
  const scoped = productType ? all.filter((l) => l.productType === productType) : all;

  const withMedian = entries.filter((e) => e.median !== null);

  const underpriced = scoped
    .filter((l) => l.discountPct !== null && l.discountPct >= 10 && l.estimateSample >= 2)
    .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0))
    .slice(0, 6);

  const gaining = withMedian
    .filter((e) => e.trend7Pct !== null && (e.trend7Pct ?? 0) > 0)
    .sort((a, b) => (b.trend7Pct ?? 0) - (a.trend7Pct ?? 0))
    .slice(0, 6);

  const falling = withMedian
    .filter((e) => e.trend7Pct !== null && (e.trend7Pct ?? 0) < 0)
    .sort((a, b) => (a.trend7Pct ?? 0) - (b.trend7Pct ?? 0))
    .slice(0, 6);

  const fastestSelling = [...scoped]
    .sort((a, b) => b.velocityScore - a.velocityScore)
    .slice(0, 6);

  const highestMargin = scoped
    .filter((l) => l.roiPct !== null)
    .sort((a, b) => (b.roiPct ?? 0) - (a.roiPct ?? 0))
    .slice(0, 6);

  const iphoneEntries = getHeatmap("iphone");
  const macEntries = getHeatmap("macbook");

  return (
    <>
      <PageHeader
        title="📊 Market Intel"
        subtitle="Markedspriser, købsgrænser og bevægelser pr. model og lagerplads — beregnet udelukkende fra prisobservationer i denne database. Ingen eksterne eller hårdkodede prisantagelser."
        originNote={<OriginLegend />}
        actions={
          <form method="get">
            <Select name="type" defaultValue={productType ?? "all"} className="h-8 w-36 text-[12.5px]">
              <option value="iphone">📱 iPhone</option>
              <option value="macbook">💻 MacBook</option>
              <option value="all">📱💻 Alle produkter</option>
            </Select>
          </form>
        }
      />

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              title="Endnu ingen prisobservationer"
              description="Market Intel udfyldes automatisk, når du importerer annoncer. Jo flere rigtige observationer, desto bedre købsgrænser."
              action={<Link href="/import" className="text-[12.5px] text-accent underline underline-offset-2">Åbn 📥 Import</Link>}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              emoji="🎯"
              title="Mest underpricet"
              body={
                underpriced.length ? (
                  <Link href={`/listings/${underpriced[0].id}`} className="text-accent hover:underline">
                    {underpriced[0].title} · {formatPct(underpriced[0].discountPct)}
                  </Link>
                ) : (
                  <span className="text-dim">IngenFund med ≥10% rabat og 2+ obs.</span>
                )
              }
            />
            <StatCard
              emoji="📈"
              title="Stigende marked (7d)"
              body={
                gaining.length ? (
                  <span className="text-warn">{gaining[0].label} · {formatPct(gaining[0].trend7Pct)}</span>
                ) : (
                  <span className="text-dim">Ingen dokumenteret stigning</span>
                )
              }
            />
            <StatCard
              emoji="📉"
              title="Faldende marked (7d)"
              body={
                falling.length ? (
                  <span className="text-good">{falling[0].label} · {formatPct(falling[0].trend7Pct)}</span>
                ) : (
                  <span className="text-dim">Ingen dokumenteret fald</span>
                )
              }
            />
            <StatCard
              emoji="⚡"
              title="Hastigst solgt (est.)"
              body={
                fastestSelling.length ? (
                  <span className="text-accent">
                    {VELOCITY_META[fastestSelling[0].velocityLevel as VelocityLevel]?.emoji}{" "}
                    {fastestSelling[0].title.slice(0, 28)}
                  </span>
                ) : (
                  <span className="text-dim">—</span>
                )
              }
            />
          </div>

          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <ListingPanel
              title="🎯 Mest underpricet lige nu"
              hint="Størst gap mellem pris og observeret markedsværdi."
              rows={underpriced}
              metric={(l) => `${formatPct(l.discountPct)} · 🪙 ${formatDkk(l.priceDkk)}`}
              empty="Ingen kvalificerende fund endnu."
            />
            <ListingPanel
              title="💰 Højeste margin"
              hint="Bedst forventede afkastning efter omkostninger."
              rows={highestMargin}
              metric={(l) => `📈 ${formatPct(l.roiPct)} · 💸 ${formatDkk(l.netProfitDkk ?? 0)}`}
              empty="Ingen kvalificerende fund endnu."
            />
            <ListingPanel
              title="⚡ Hastigst solgt (estimeret)"
              hint="Sorteret efter hastighedsscore: alder, rabat, efterspørgsel og historik."
              rows={fastestSelling}
              metric={(l) => `${VELOCITY_META[l.velocityLevel as VelocityLevel]?.emoji ?? "💨"} ${VELOCITY_META[l.velocityLevel as VelocityLevel]?.label ?? l.velocityLevel}`}
              empty="Ingen fund."
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px]">📱💻 Modelkort</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ModelMini title="📱 iPhone" rows={iphoneEntries} />
                <ModelMini title="💻 MacBook" rows={macEntries} />
              </CardContent>
            </Card>
          </div>

          {gaining.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-[13px]">📈 Stigende markeder (7 dage)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-line">
                  {gaining.map((e) => (
                    <li key={e.specKey} className="flex items-center gap-3 px-3 py-1.5 text-[12px]">
                      <span className="min-w-0 flex-1 truncate text-ink">{e.label}</span>
                      <span className="mono text-dim">median {formatDkk(e.median)}</span>
                      <span className="mono w-16 text-right text-warn">+{formatNumber(e.trend7Pct ?? 0)}%</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {falling.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-[13px]">📉 Faldende markeder (7 dage)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-line">
                  {falling.map((e) => (
                    <li key={e.specKey} className="flex items-center gap-3 px-3 py-1.5 text-[12px]">
                      <span className="min-w-0 flex-1 truncate text-ink">{e.label}</span>
                      <span className="mono text-dim">median {formatDkk(e.median)}</span>
                      <span className="mono w-16 text-right text-good">{formatNumber(e.trend7Pct ?? 0)}%</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">📐 Prisstruktur · {entries.length} konfigurationer</CardTitle>
            </CardHeader>
            <CardContent>
              <HeatmapTable entries={entries} productType={productType ?? "alle"} query="" />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function StatCard({ emoji, title, body }: { emoji: string; title: string; body: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
      <div className="eyebrow">
        {emoji} {title}
      </div>
      <div className="mt-1 truncate text-[12.5px]">{body}</div>
    </div>
  );
}

function ListingPanel({
  title,
  hint,
  rows,
  metric,
  empty,
}: {
  title: string;
  hint: string;
  rows: ListingView[];
  metric: (l: ListingView) => string;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-dim">{empty}</p>
        ) : (
          <>
            <p className="px-3 pt-2 text-[11px] text-dim">{hint}</p>
            <ul className="mt-1 divide-y divide-line">
              {rows.map((l) => (
                <li key={l.id} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
                  <Link href={`/listings/${l.id}`} className="min-w-0 flex-1 truncate text-accent hover:underline">
                    {l.title}
                  </Link>
                  <OriginBadge origin={l.origin} />
                  <TierBadge tier={l.dealTier} />
                  <span className="mono w-36 shrink-0 text-right text-muted">{metric(l)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ModelMini({ title, rows }: { title: string; rows: HeatmapEntry[] }) {
  const top = rows.filter((r) => r.median !== null).sort((a, b) => (b.sampleCount ?? 0) - (a.sampleCount ?? 0)).slice(0, 4);
  return (
    <div className="rounded-md border border-line bg-panel-2 p-2.5">
      <div className="eyebrow">{title}</div>
      {top.length === 0 ? (
        <p className="mt-1 text-[11.5px] text-dim">Ingen data</p>
      ) : (
        <ul className="mono mt-1.5 space-y-0.5 text-[11.5px]">
          {top.map((r) => (
            <li key={r.specKey} className="flex justify-between gap-2">
              <span className="min-w-0 truncate text-muted">{r.label}</span>
              <span className="shrink-0 text-ink">
                {formatDkk(r.median)} <span className="text-dim">({r.sampleCount})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
