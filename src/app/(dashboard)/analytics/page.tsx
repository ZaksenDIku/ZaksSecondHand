import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getAnalytics, getFlips, getAllListings } from "@/lib/db/queries";
import { getAppSettings } from "@/lib/db/settings";
import { PageHeader, OriginLegend } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDkk, formatPct, formatNumber, formatDate } from "@/lib/core/format";
import { hiddenGemScore } from "@/lib/core/hidden-gem";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await ensureBootstrap();
  const a = getAnalytics();
  const flips = getFlips();
  const listings = getAllListings();
  const settings = getAppSettings();
  const visible = settings.demo.enabled ? listings : listings.filter((l) => l.origin !== "DEMO");

  const closed = flips.filter((f) => f.salePriceDkk !== null);
  const ranked = [...closed].sort((x, y) => (y.profit ?? 0) - (x.profit ?? 0));
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const iphone = closed.filter((f) => /iphone/i.test(f.productLabel));
  const mac = closed.filter((f) => /macbook/i.test(f.productLabel));
  const avg = (rows: typeof closed, key: "profit" | "roi") =>
    rows.length ? rows.reduce((s, f) => s + (f[key] ?? 0), 0) / rows.length : null;

  const gems = visible
    .filter((l) =>
      hiddenGemScore({
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
      }).score >= 35
    ).length;

  const tierCounts = visible.reduce<Record<string, number>>((acc, l) => {
    acc[l.dealTier] = (acc[l.dealTier] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="📈 Analytics"
        subtitle="Resultater for dine videresalg og et overblik over, hvor fundene kommer fra. Tallene bygger kun på registrerede køb og importerede data."
        originNote={<OriginLegend />}
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Stat emoji="💰" label="Samlet profit" value={formatDkk(a.profit)} tone={a.profit >= 0 ? "good" : "danger"} />
        <Stat emoji="📈" label="Gennemsnitlig ROI" value={formatPct(a.avgRoi)} tone={a.avgRoi >= 0 ? "good" : "danger"} />
        <Stat emoji="🛒" label="Kapital investeret" value={formatDkk(a.totalInvested)} />
        <Stat emoji="⏱" label="Gennemsnitlig holdetid" value={`${formatNumber(a.avgHoldingDays)} dage`} />
        <Stat emoji="🔄" label="Afsluttede flips" value={formatNumber(a.closedCount)} />
        <Stat emoji="🎯" label="Vinderrate" value={`${formatNumber(a.winRate)} %`} tone={a.winRate >= 50 ? "good" : "warn"} />
      </div>

      {flips.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              title="Ingen videresalg at analysere endnu"
              description="Når du registrerer køb under 💸 Flips, udarbejdes profit, ROI, holdetid og modelrangliste automatisk her."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">🏆 Bedste flip</CardTitle>
            </CardHeader>
            <CardContent>
              {best ? (
                <div>
                  <div className="text-[13px] text-ink">{best.productLabel}</div>
                  <div className="mono mt-2 text-[22px] font-bold text-good">💸 {formatDkk(best.profit ?? 0)}</div>
                  <div className="mono mt-1 text-[12px] text-dim">
                    🪙 {formatDkk(best.purchasePriceDkk)} → 💰 {formatDkk(best.salePriceDkk ?? 0)} · 📈{" "}
                    {formatPct(best.roi)} · ⏱ {best.daysHeld} dage
                  </div>
                  <div className="mt-1 text-[11.5px] text-dim">📅 solgt {formatDate(best.saleDate)}</div>
                </div>
              ) : (
                <p className="text-[12px] text-dim">Ingen afsluttede salg endnu.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">📉 Dårligste flip</CardTitle>
            </CardHeader>
            <CardContent>
              {worst ? (
                <div>
                  <div className="text-[13px] text-ink">{worst.productLabel}</div>
                  <div
                    className={`mono mt-2 text-[22px] font-bold ${(worst.profit ?? 0) >= 0 ? "text-good" : "text-danger"}`}
                  >
                    💸 {formatDkk(worst.profit ?? 0)}
                  </div>
                  <div className="mono mt-1 text-[12px] text-dim">
                    🪙 {formatDkk(worst.purchasePriceDkk)} → 💰 {formatDkk(worst.salePriceDkk ?? 0)} · 📈{" "}
                    {formatPct(worst.roi)}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-dim">Kun ét afsluttet salg — intet at sammenligne med.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">📊 Modelranking</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-line">
                {a.byModel.map((m) => (
                  <li key={m.model} className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
                    <span className="min-w-0 flex-1 truncate text-ink">{m.model}</span>
                    <span className="mono text-dim">{m.count}×</span>
                    <span className={`mono w-20 text-right ${m.profit >= 0 ? "text-good" : "text-danger"}`}>
                      {formatDkk(m.profit)}
                    </span>
                    <span className="mono w-14 text-right text-dim">{formatPct(m.avgRoi, 0)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">📱 iPhone vs 💻 MacBook</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Segment
                title="📱 iPhone"
                count={iphone.length}
                profit={avg(iphone, "profit")}
                roi={avg(iphone, "roi")}
              />
              <Segment title="💻 MacBook" count={mac.length} profit={avg(mac, "profit")} roi={avg(mac, "roi")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">🎯 Fundfordeling ({visible.length} opsamlede)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-[12px]">
              {(["URGENT", "HOT", "GREAT", "GOOD", "NORMAL"] as const).map((t) => {
                const n = tierCounts[t] ?? 0;
                const pct = visible.length ? (n / visible.length) * 100 : 0;
                return (
                  <li key={t} className="flex items-center gap-2">
                    <span className="w-24 text-muted">
                      {t === "URGENT" ? "🚨" : t === "HOT" ? "🔥" : t === "GREAT" ? "🟠" : t === "GOOD" ? "🟢" : "🔵"} {t}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
                      <span
                        className={`block h-full ${
                          t === "URGENT" ? "bg-steal" : t === "HOT" ? "bg-accent" : t === "GREAT" ? "bg-accent/70" : t === "GOOD" ? "bg-good" : "bg-fair/60"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="mono w-10 text-right text-dim">{n}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-dim">💎 {gems} hidden gems i det aktuelle datasæt.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Stat({ emoji, label, value, tone = "default" }: { emoji: string; label: string; value: string; tone?: string }) {
  const color = tone === "good" ? "text-good" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-dim">
        {emoji} {label}
      </div>
      <div className={`mono mt-1 text-[16px] font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Segment({
  title,
  count,
  profit,
  roi,
}: {
  title: string;
  count: number;
  profit: number | null;
  roi: number | null;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-3">
      <div className="text-[12.5px] text-ink">{title}</div>
      <div className="mono mt-1 text-[11px] text-dim">{count} afsluttede</div>
      <div className={`mono mt-2 text-[16px] font-bold ${(profit ?? 0) >= 0 ? "text-good" : "text-danger"}`}>
        {profit === null ? "—" : formatDkk(profit)}
      </div>
      <div className="mono text-[11px] text-dim">📈 {roi === null ? "—" : formatPct(roi)}</div>
    </div>
  );
}
