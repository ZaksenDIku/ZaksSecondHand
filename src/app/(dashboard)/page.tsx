import Link from "next/link";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAllListings, getDashboardKpis } from "@/lib/db/queries";
import { getAppSettings } from "@/lib/db/settings";
import { formatDkk, formatPct, formatAge, formatNumber } from "@/lib/core/format";
import { computeVelocity } from "@/lib/core/velocity";
import { smartSummary } from "@/lib/core/smart-summary";
import { hiddenGemScore } from "@/lib/core/hidden-gem";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OriginBadge, TierBadge, RiskBadge, VelocityBadge, tierTone, toneClass } from "@/components/domain/badges";
import type { ListingView } from "@/lib/view-types";

export const dynamic = "force-dynamic";

/** Signals a listing may vanish before you have decided. */
function velocityFor(l: ListingView) {
  return computeVelocity({
    postedAt: l.postedAt,
    discountPct: l.discountPct,
    dealScore: l.dealScore,
    sampleCount: l.estimateSample,
    priceDkk: l.priceDkk,
    marketMedianDkk: l.marketValueDkk,
    productType: (l.productType ?? null) as never,
  });
}

export default async function DealCenterPage() {
  await ensureBootstrap();
  const settings = getAppSettings();
  const all = getAllListings().filter((l) => !l.ignored && !l.duplicateOf && l.status !== "archived");
  const visible = settings.demo.enabled ? all : all.filter((l) => l.origin !== "DEMO");
  const kpis = getDashboardKpis();

  const urgent = visible
    .filter((l) => l.dealTier === "URGENT")
    .sort((a, b) => b.dealScore - a.dealScore)
    .slice(0, 6);
  const hot = visible
    .filter((l) => l.dealTier === "HOT" || l.dealTier === "GREAT")
    .sort((a, b) => b.dealScore - a.dealScore)
    .slice(0, 8);
  const newest = [...visible].sort((a, b) => (b.postedAt ?? b.firstSeenAt) - (a.postedAt ?? a.firstSeenAt)).slice(0, 12);
  const priceDrops = visible
    .filter((l) => l.priceChangedFrom !== null && l.priceChangedFrom > l.priceDkk)
    .sort((a, b) => (b.priceChangedFrom ?? 0) - b.priceDkk - ((a.priceChangedFrom ?? 0) - a.priceDkk))
    .slice(0, 6);
  const gems = visible
    .map((l) => ({
      listing: l,
      gem: hiddenGemScore({
        rawTitle: l.rawTitle,
        description: l.description,
        title: l.title,
        parseConfidence: l.parseConfidence,
        parseAmbiguous: l.parseAmbiguous,
        discountPct: l.discountPct,
        productType: l.productType,
        storageGb: l.storageGb,
        ramGb: l.ramGb,
        condition: l.condition,
        batteryHealth: l.batteryHealth,
        descriptionLength: l.description.length,
      }),
    }))
    .filter((g) => g.gem.score >= 35)
    .sort((a, b) => b.gem.score - a.gem.score)
    .slice(0, 6);

  const watchMatches = visible.filter((l) => l.watchlisted).length;
  const potentialProfit = visible
    .filter((l) => (l.netProfitDkk ?? 0) > 0)
    .slice(0, 40)
    .reduce((s, l) => s + (l.netProfitDkk ?? 0), 0);
  const lastHour = visible.filter((l) => l.ageMin <= 60).length;

  const commandCards = [
    {
      emoji: "🔥",
      label: `${kpis.hotDeals} HOT DEALS`,
      hint: "Dealscore 85+",
      href: "/live?min=85",
      tone: "hot",
    },
    {
      emoji: "⚡",
      label: `${lastHour} NYE ANNONCER`,
      hint: "Seneste time",
      href: "/live?age=60",
      tone: "urgent",
    },
    {
      emoji: "💸",
      label: `${formatDkk(potentialProfit)} POTENTIAL PROFIT`,
      hint: "Top 40 med positiv margin",
      href: "/live?sort=profit",
      tone: "good",
    },
    {
      emoji: "🚨",
      label: `${urgent.length} URGENTE CHANCER`,
      hint: "Stærk rabat + frisk + margin",
      href: "/live?min=93",
      tone: "urgent",
    },
    {
      emoji: "👀",
      label: `${watchMatches} WATCHLIST-MATCHES`,
      hint: "Gemte fund",
      href: "/watchlist",
      tone: "check",
    },
    {
      emoji: "📉",
      label: `${priceDrops.length} PRISFALD`,
      hint: "Nedad siden første hentning",
      href: "/live?drops=1",
      tone: "good",
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">🔥 Deal Center</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Alt du skal vide lige nu: hvad der er stærkest, hvad der forsvinder hurtigst, og hvad der har ændret sig
          siden sidste blik. Priser og markedsværdier kommer kun fra observerede data i denne database.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {commandCards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-lg border px-3 py-2.5 transition-opacity hover:opacity-80 ${toneClass(c.tone)}`}
          >
            <div className="text-[11.5px] font-semibold leading-tight">{c.label}</div>
            <div className="mt-0.5 text-[10.5px] opacity-70">{c.hint}</div>
          </Link>
        ))}
      </div>

      <section>
        <SectionTitle emoji="🔥" title="HOT RIGHT NOW" count={urgent.length} />
        {urgent.length === 0 ? (
          <Card>
            <CardContent className="p-5">
              <p className="text-[13px] text-muted">
                Ingen 🚨 URGENT STEAL lige nu. Urgent kræver samtidig stærkt rabat, frisk annonce og reel margin.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {urgent.map((l) => (
              <HotCard key={l.id} l={l} />
            ))}
          </div>
        )}
      </section>

      {hot.length > 0 && (
        <section>
          <SectionTitle emoji="💎" title="STÆRKESTE OPPORTUNITETER" count={hot.length} />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {hot.map((l) => (
              <HotCard key={l.id} l={l} compact />
            ))}
          </div>
        </section>
      )}

      {priceDrops.length > 0 && (
        <section>
          <SectionTitle emoji="📉" title="PRISFALD" count={priceDrops.length} />
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-line">
                {priceDrops.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <OriginBadge origin={l.origin} />
                    <Link href={`/listings/${l.id}`} className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-accent">
                      {l.productType === "macbook" ? "💻" : "📱"} {l.title}
                    </Link>
                    <span className="mono text-[12px] text-dim line-through">{formatDkk(l.priceChangedFrom)}</span>
                    <span className="mono text-[12px] text-ink">→ {formatDkk(l.priceDkk)}</span>
                    <span className="mono text-[12px] font-semibold text-good">
                      📉 −{formatDkk((l.priceChangedFrom ?? 0) - l.priceDkk)}
                    </span>
                    <TierBadge tier={l.dealTier} />
                    <span className="text-[11px] text-dim">{formatAge(l.lastSeenAt)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {gems.length > 0 && (
        <section>
          <SectionTitle emoji="💎" title="HIDDEN GEMS" count={gems.length} />
          <div className="grid gap-3 lg:grid-cols-2">
            {gems.map(({ listing: l, gem }) => (
              <Card key={l.id}>
                <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-[13px]">💎 HIDDEN GEM</CardTitle>
                    <p className="mt-1 text-[11.5px] text-dim">
                      Annoncetitel: <span className="italic">“{l.rawTitle}”</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <OriginBadge origin={l.origin} />
                    <Badge tone={l.parseAmbiguous ? "demo" : "neutral"}>🧠 match {Math.round(l.parseConfidence * 100)} %</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[12.5px] text-ink">
                    🧠 Detekteret: <span className="font-medium text-accent">{l.title}</span>
                    {l.storageGb ? ` · ${l.storageGb} GB` : ""}
                    {l.ramGb ? ` · ${l.ramGb} GB RAM` : ""}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {gem.reasons.slice(0, 4).map((r, i) => (
                      <li key={i} className="text-[11.5px] text-muted">
                        {r.emoji} {r.text}
                      </li>
                    ))}
                  </ul>
                  {gem.hypothesis && (
                    <p className="mt-2 rounded-md border border-warn/30 bg-warn/8 px-2 py-1.5 text-[11.5px] text-warn">
                      ⚠️ {gem.hypothesis}
                    </p>
                  )}
                  <div className="mono mt-2 flex items-center gap-3 text-[11.5px] text-dim">
                    <span>🪙 {formatDkk(l.priceDkk)}</span>
                    {l.marketValueDkk ? <span>💰 {formatDkk(l.marketValueDkk)}</span> : null}
                    {l.discountPct ? <span className="text-good">📉 {formatPct(l.discountPct, 0)} under</span> : null}
                    <Link href={`/listings/${l.id}`} className="ml-auto text-accent hover:underline">
                      Åbn →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle
          emoji="⚡"
          title="LIVE DEAL FEED"
          count={newest.length}
          action={
            <Link href="/live" className="text-[12px] text-muted hover:text-ink">
              Alle deals →
            </Link>
          }
        />
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-line">
              {newest.map((l) => {
                const v = velocityFor(l);
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <TierBadge tier={l.dealTier} />
                    <span className="w-8 text-center text-[13px]">{l.productType === "macbook" ? "💻" : "📱"}</span>
                    <Link
                      href={`/listings/${l.id}`}
                      className="min-w-0 flex-1 truncate text-[12.5px] text-ink hover:text-accent"
                    >
                      {l.title}
                    </Link>
                    <span className="text-[11px] uppercase text-dim">🛒 {l.marketplaceKey}</span>
                    <span className="mono w-16 text-right text-[12px] text-ink">🪙 {formatDkk(l.priceDkk)}</span>
                    <span className="mono hidden w-16 text-right text-[12px] text-fair sm:block">
                      {l.marketValueDkk ? `💰 ${formatDkk(l.marketValueDkk)}` : "—"}
                    </span>
                    <span
                      className={`mono w-16 text-right text-[12px] ${
                        (l.netProfitDkk ?? 0) > 0 ? "text-good" : "text-dim"
                      }`}
                    >
                      {l.netProfitDkk !== null ? `💸 ${formatDkk(l.netProfitDkk)}` : "—"}
                    </span>
                    <span className="mono w-9 text-right text-[12px] font-semibold text-ink">🎯 {l.dealScore}</span>
                    <VelocityBadge level={v.level} />
                    <span className="mono w-12 text-right text-[11px] text-dim">{formatAge(l.postedAt)}</span>
                    <RiskBadge level={l.riskLevel} score={l.riskScore} />
                    <OriginBadge origin={l.origin} />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>

      {all.length === 0 && (
        <EmptyState
          title="Ingen data endnu"
          description="Importér URL'er, fritekst, CSV/JSON eller e-mail-alerts for at komme i gang - eller slå DEMO fra for kun at se rigtige data."
          action={
            <Link href="/import">
              <span className="text-[12.5px] text-accent underline underline-offset-2">Åbn import</span>
            </Link>
          }
        />
      )}

      <p className="text-[11px] text-dim">
        Datagrundlag: {formatNumber(kpis.realCount)} REAL · {formatNumber(kpis.importedCount)} IMPORTED ·{" "}
        {formatNumber(kpis.demoCount)} DEMO · {formatNumber(kpis.staleCount)} STALE ·{" "}
        {formatNumber(kpis.duplicatesHidden)} dubletter skjult
      </p>
    </div>
  );
}

function SectionTitle({
  emoji,
  title,
  count,
  action,
}: {
  emoji: string;
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <h2 className="text-[13px] font-semibold tracking-wide text-ink">
        <span aria-hidden>{emoji}</span> {title}
      </h2>
      {count !== undefined && <span className="mono text-[11px] text-dim">{count}</span>}
      <div className="flex-1" />
      {action}
    </div>
  );
}

function HotCard({ l, compact = false }: { l: ListingView; compact?: boolean }) {
  const lines = smartSummary({
    title: l.title,
    priceDkk: l.priceDkk,
    marketValueDkk: l.marketValueDkk,
    quickSaleValueDkk: l.quickSaleValueDkk,
    discountPct: l.discountPct,
    netProfitDkk: l.netProfitDkk,
    roiPct: l.roiPct,
    dealScore: l.dealScore,
    riskScore: l.riskScore,
    riskLevel: l.riskLevel,
    ageMin: l.ageMin,
    batteryHealth: l.batteryHealth,
    estimateSample: l.estimateSample,
    estimateConfidence: l.estimateConfidence,
    storageGb: l.storageGb,
    productType: l.productType,
    distanceKm: l.distanceKm,
    origin: l.origin,
    parseConfidence: l.parseConfidence,
    parseAmbiguous: l.parseAmbiguous,
    riskCodes: [],
    snapshotCount: l.snapshotCount,
    priceDrop: l.priceDrop,
    velocityLabel: velocityFor(l).label,
  });
  const v = velocityFor(l);
  const tone = tierTone(l.dealTier);

  return (
    <Card className={`overflow-hidden ${l.dealTier === "URGENT" ? "glow-steal" : ""}`}>
      <div className={`h-1 w-full ${l.dealTier === "URGENT" ? "bg-steal" : l.dealTier === "HOT" ? "bg-accent" : "bg-good"}`} />
      <CardHeader className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-[13px]">
              {l.dealTier === "URGENT" ? "🚨" : l.dealTier === "HOT" ? "🔥" : l.productType === "macbook" ? "💻" : "📱"}{" "}
              {l.title}
            </CardTitle>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-dim">
              🛒 {l.marketplaceKey}
              {l.location ? ` · 📍 ${l.location}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`mono text-[22px] font-bold leading-none ${toneClass(tone).split(" ").pop()}`}>
              {l.dealScore}
            </span>
            <span className="text-[9.5px] uppercase tracking-wider text-dim">DealScore</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <TierBadge tier={l.dealTier} />
          <VelocityBadge level={v.level} />
          <RiskBadge level={l.riskLevel} score={l.riskScore} />
          <OriginBadge origin={l.origin} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mono grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-4">
          <Cell label="🪙 Pris" value={formatDkk(l.priceDkk)} />
          <Cell label="💰 Marked" value={l.marketValueDkk ? formatDkk(l.marketValueDkk) : "—"} tone="fair" />
          <Cell
            label="💸 Netto"
            value={l.netProfitDkk !== null ? `+${formatDkk(l.netProfitDkk)}` : "—"}
            tone={(l.netProfitDkk ?? 0) > 0 ? "good" : "dim"}
          />
          <Cell
            label="📉 Under marked"
            value={l.discountPct !== null ? `${formatPct(l.discountPct, 0)}` : "—"}
            tone={(l.discountPct ?? 0) > 15 ? "great" : "dim"}
          />
        </div>

        {!compact && (
          <div className="mt-2.5 rounded-md border border-line bg-panel-2 p-2">
            <div className="eyebrow mb-1">🧠 Hvorfor denne er interessant</div>
            <ul className="space-y-0.5">
              {lines.slice(0, 6).map((line, i) => (
                <li key={i} className="text-[11.5px] text-muted">
                  {line.emoji} {line.text}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[10.5px] text-dim">💨 {v.reason}</p>
          </div>
        )}

        <div className="mono mt-2 flex items-center gap-2 text-[11px] text-dim">
          ⚡ {formatAge(l.postedAt)}
          {l.roiPct !== null && <span>· 📈 {formatPct(l.roiPct, 0)} ROI</span>}
          {l.estimateSample > 0 && <span>· 📊 {l.estimateSample} obs</span>}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {l.url ? (
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-md border border-line bg-panel-2 px-2 py-1 text-[11.5px] text-ink transition-colors hover:border-line-2"
            >
              🔗 Åbn annonce
            </a>
          ) : (
            <span className="rounded-md border border-line bg-panel-2 px-2 py-1 text-[11.5px] text-dim">
              🔗 Intet link (manuel import)
            </span>
          )}
          <Link
            href={`/listings/${l.id}`}
            className="rounded-md border border-line bg-panel-2 px-2 py-1 text-[11.5px] text-ink transition-colors hover:border-line-2"
          >
            👀 Watch
          </Link>
          <Link
            href={`/listings/${l.id}#offer`}
            className="rounded-md border border-line bg-panel-2 px-2 py-1 text-[11.5px] text-ink transition-colors hover:border-line-2"
          >
            💬 Kontakt
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  const color =
    tone === "good"
      ? "text-good"
      : tone === "great"
        ? "text-accent"
        : tone === "fair"
          ? "text-fair"
          : tone === "dim"
            ? "text-dim"
            : "text-ink";
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`text-[13px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}
