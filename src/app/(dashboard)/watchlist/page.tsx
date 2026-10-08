import Link from "next/link";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getWatchlist } from "@/lib/db/queries";
import {PageHeader} from "@/components/domain/page-header";
import { WatchRuleForm, WatchRuleDelete } from "@/components/domain/watch-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { OriginBadge, TierBadge, RiskBadge, VelocityBadge } from "@/components/domain/badges";
import { formatDkk, formatPct, formatAge } from "@/lib/core/format";
import { computeFlip } from "@/lib/core/flip";
import { getAppSettings } from "@/lib/db/settings";

/** Målmargin: hvor meget under medianen en annonce skal ligge, før watch-reglen regnes som et 🔥 TARGET HIT. */
const TARGET_MARGIN_PCT = 12;

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  await ensureBootstrap();
  const rows = getWatchlist();
  const settings = getAppSettings();

  return (
    <>
      <PageHeader
        title="Watchlist"
        subtitle="Regler og gemte fund. Prisen sammenlignes med medianen af observerede salgspriser for præcis samme konfiguration - aldrig med hårdkodede prisantagelser."
      />

      <div className="mb-5">
        <WatchRuleForm />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Ingen watch-regler endnu"
          description="Opret en regel ovenfor, eller tryk på stjernen i en annonce for at gemme den enkeltvis."
          action={
            <Link href="/live">
              <span className="text-[12.5px] text-accent underline underline-offset-2">Se live deals</span>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => {
            const match = r.matchingListings[0];
            const targetHit =
              r.currentCheapest !== null &&
              r.marketMedian !== null &&
              (r.currentCheapest <= r.marketMedian * (1 - TARGET_MARGIN_PCT / 100) ||
                (r.maxPriceDkk !== null && r.currentCheapest <= r.maxPriceDkk));
            const waiting = !targetHit;
            const flip =
              match && r.marketMedian !== null
                ? computeFlip({
                    purchasePrice: r.currentCheapest ?? match.priceDkk,
                    expectedResale: r.marketMedian,
                    negotiationAdjustmentDkk: 0,
                    ...settings.flip,
                  })
                : null;
            return (
              <Card key={r.id}>
                <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-[13px]">{r.label}</CardTitle>
                    <p className="mono mt-1 text-[11px] text-dim">
                      {r.productType ?? "alle modeller"}
                      {r.storageGb ? ` · ${r.storageGb} GB` : ""}
                      {r.maxPriceDkk ? ` · maks ${formatDkk(r.maxPriceDkk)}` : ""}
                      {r.minDealScore ? ` · score ≥ ${r.minDealScore}` : ""}
                      {r.minProfitDkk ? ` · profit ≥ ${formatDkk(r.minProfitDkk)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {targetHit ? (
                      <Badge tone="steal">🔥 TARGET HIT</Badge>
                    ) : (
                      <Badge tone="muted">⏳ WAIT</Badge>
                    )}
                    <Badge tone={r.enabled ? "good" : "muted"}>{r.enabled ? "Aktiv" : "Paused"}</Badge>
                    <WatchRuleDelete id={r.id} />
                  </div>
                </CardHeader>
                <CardContent>
                  {targetHit && (
                    <p className="mb-2.5 rounded-md border border-steal/40 bg-steal/10 px-2.5 py-1.5 text-[12px] text-steal">
                      🔥 Målet er nået: {formatDkk(r.currentCheapest!)} mod median {formatDkk(r.marketMedian!)} —{" "}
                      {formatDkk(Math.round(r.marketMedian! - r.currentCheapest!))} under markedsværdi.
                    </p>
                  )}
                  {waiting && r.currentCheapest !== null && r.marketMedian !== null && (
                    <p className="mb-2.5 text-[11.5px] text-dim">
                      ⏳ Vent — {formatDkk(Math.round(r.marketMedian! - r.currentCheapest!))} endnu til den
                      billigste pris for at nå {TARGET_MARGIN_PCT}% under median.
                    </p>
                  )}
                  <div className="mono grid grid-cols-3 gap-2 rounded-lg border border-line bg-panel-2 p-2.5 text-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-dim">Billigste</div>
                      <div className="mt-0.5 text-[14px] font-semibold text-ink">
                        {r.currentCheapest ? formatDkk(r.currentCheapest) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-dim">Median</div>
                      <div className="mt-0.5 text-[14px] font-semibold text-ink">
                        {r.marketMedian ? formatDkk(r.marketMedian) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-dim">Forskel</div>
                      <div
                        className={`mt-0.5 text-[14px] font-semibold ${
                          r.difference === null
                            ? "text-dim"
                            : r.difference > 0
                              ? "text-good"
                              : "text-danger"
                        }`}
                      >
                        {r.difference === null ? "—" : formatPct(r.difference)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11.5px] text-dim">
                    <span>
                      {r.matchingCount} match{r.matchingCount === 1 ? "" : "es"} · sidste{" "}
                      {r.lastMatchAt ? formatAge(r.lastMatchAt) : "aldrig"}
                    </span>
                    {flip && (
                      <span className="mono">
                        estimat {formatDkk(flip.netProfit)} · {formatPct(flip.roiPct)} ROI
                      </span>
                    )}
                  </div>

                  {r.matchingListings.length > 0 && (
                    <ul className="mt-2 divide-y divide-line border-t border-line">
                      {r.matchingListings.slice(0, 4).map((l) => (
                        <li key={l.id} className="flex items-center gap-2 py-1.5">
                          <OriginBadge origin={l.origin} />
                          <Link
                            href={`/listings/${l.id}`}
                            className="min-w-0 flex-1 truncate text-[12.5px] text-ink hover:text-accent"
                          >
                            {l.title}
                          </Link>
                          <TierBadge tier={l.dealScore >= 85 ? "GREAT" : l.dealScore >= 70 ? "GOOD" : "FAIR"} />
                          <RiskBadge level={l.riskLevel} />
                          <VelocityBadge level={l.velocityLevel} />
                          <span className="mono w-16 text-right text-[12px] text-ink">{formatDkk(l.priceDkk)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
