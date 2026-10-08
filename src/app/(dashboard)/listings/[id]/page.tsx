import { notFound } from "next/navigation";
import Link from "next/link";
import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getListingDetail, getFlips, getMarketplaces } from "@/lib/db/queries";
import { getAppSettings } from "@/lib/db/settings";
import { smartSummary } from "@/lib/core/smart-summary";
import { hiddenGemScore } from "@/lib/core/hidden-gem";
import { generateOffers, negotiationPoints } from "@/lib/core/negotiation";
import { checklistFor, IPHONE_CHECKLIST, MACBOOK_CHECKLIST } from "@/lib/core/checklists";
import { resaleTarget } from "@/lib/core/flip";
import { formatDkk, formatPct, formatDateTime, formatNumber, formatDate } from "@/lib/core/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";
import {
  OriginBadge,
  TierBadge,
  RiskBadge,
  VelocityBadge,
  AiParsedBadge,
  HiddenGemBadge,
  ConfidenceBadge,
  JustListedBadge,
} from "@/components/domain/badges";
import { ActionButton, AddToWatchButton } from "@/components/domain/listing-actions";
import { FlipCalculator } from "@/components/domain/flip-calculator";
import { Checklist, OfferBuilder } from "@/components/domain/listing-tools";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureBootstrap();
  const detail = getListingDetail(id);
  if (!detail) notFound();
  const l = detail.listing;
  const settings = getAppSettings();
  const flip = getFlips().find((f) => f.listingId === l.id) ?? null;
  const mpName = getMarketplaces().find((m) => m.key === l.marketplaceKey)?.name ?? l.marketplaceKey;

  const summaryLines = smartSummary({
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
    riskCodes: detail.signals.map((s) => s.code),
    snapshotCount: l.snapshotCount,
    priceDrop: l.priceDrop,
    velocityLabel: l.velocityLevel,
  });

  const gem = hiddenGemScore({
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
  });

  const daysListed = Math.max(0, Math.round(l.ageMin / 1440));
  const offers = generateOffers({
    modelLabel: l.title,
    askingPrice: l.priceDkk,
    marketMedian: l.marketValueDkk,
    quickSale: l.quickSaleValueDkk,
    daysListed,
    batteryHealth: l.batteryHealth,
    location: l.location,
  });
  const points = negotiationPoints({
    modelLabel: l.title,
    askingPrice: l.priceDkk,
    marketMedian: l.marketValueDkk,
    quickSale: l.quickSaleValueDkk,
    daysListed,
    batteryHealth: l.batteryHealth,
    location: l.location,
  });

  const checklist = checklistFor(l.productType).map((item) => {
    let ok = false;
    if (item.id === "battery" && l.batteryHealth !== null) ok = l.batteryHealth >= 85;
    return { label: item.detail ? `${item.label} — ${item.detail}` : item.label, ok };
  });

  const maxBuy =
    l.marketValueDkk !== null
      ? Math.max(0, Math.round(l.marketValueDkk - Math.max(200, l.marketValueDkk * 0.12)))
      : null;
  const targetSale = flip?.offerDkk ?? resaleTarget(l.marketValueDkk, l.quickSaleValueDkk) ?? Math.round(l.priceDkk * 1.15);

  const snaps = detail.snapshots;
  const priceDelta = snaps.length >= 2 ? snaps[snaps.length - 1].priceDkk - snaps[0].priceDkk : 0;
  const factors = detail.factors;
  const comps = detail.comparables;

  return (
    <>
      <PageHeader
        title={l.title}
        subtitle={`${formatDkk(l.priceDkk)} · ${l.location ?? "Ukendt sted"} · ${mpName} · først set ${formatDateTime(l.firstSeenAt)}`}
        originNote={
          <div className="flex flex-wrap items-center gap-1.5">
            <OriginBadge origin={l.origin} />
            <TierBadge tier={l.dealTier} />
            <RiskBadge level={l.riskLevel} score={l.riskScore} />
            <VelocityBadge level={l.velocityLevel} />
            {l.aiParsed && <AiParsedBadge />}
            {gem.score >= 35 && <HiddenGemBadge />}
            {l.duplicateOf && <span className="badge text-warn">🔗 Dublet</span>}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {l.url && (
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-[12px] text-accent hover:bg-accent/20"
          >
            ↗ Åbn originalannonce
          </a>
        )}
        <ActionButton listingId={l.id} action="watch" label="👀 Overvåg" active={l.watchlisted} tone="primary" />
        {l.watchlisted && <ActionButton listingId={l.id} action="unwatch" label="Fjern overvågning" />}
        <ActionButton listingId={l.id} action="ignore" label="🙈 Skjul" active={l.ignored} />
        <ActionButton listingId={l.id} action="contact" label="✉️ Markér kontaktet" done />
        <ActionButton listingId={l.id} action="purchase" label="💸 Markér købt" done />
        <AddToWatchButton listingId={l.id} name={l.canonicalKey ?? l.title} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">🧠 Smart Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {summaryLines.map((s, i) => (
                  <li key={i} className="text-[12.5px] leading-relaxed text-muted">
                    <span className="mr-1.5">{s.emoji}</span>
                    {s.text}
                  </li>
                ))}
              </ul>
              {l.description && (
                <details className="mt-2.5">
                  <summary className="cursor-pointer text-[11.5px] text-dim">Vis rå sælgertekst</summary>
                  <p className="mono mt-1.5 whitespace-pre-wrap text-[11.5px] text-muted">{l.description}</p>
                </details>
              )}
            </CardContent>
          </Card>

          {gem.score >= 20 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px]">💎 Hidden Gem-analyse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mono mb-2 text-[26px] font-bold text-ai">💎 {gem.score}/100</div>
                <ul className="space-y-1">
                  {gem.reasons.map((r, i) => (
                    <li key={i} className="text-[12.5px] text-muted">
                      <span className="mr-1.5">{r.emoji}</span>
                      {r.text}
                    </li>
                  ))}
                </ul>
                {gem.hypothesis && (
                  <p className="mt-2 rounded-md border border-ai/30 bg-ai/8 px-2.5 py-2 text-[12px] text-ai">
                    🤔 Hypotese: {gem.hypothesis}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-dim">🔬 Registreret ud fra: {gem.detected.join(" · ") || "ingen særlige mønstre"}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">📉 Prisforløb ({snaps.length} målinger)</CardTitle>
            </CardHeader>
            <CardContent>
              {snaps.length === 0 ? (
                <p className="text-[12px] text-dim">Ingen prisdata indsamlet endnu — importér igen senere for at se udviklingen.</p>
              ) : (
                <>
                  <div className="flex h-32 items-end gap-1">
                    {snaps.map((s) => {
                      const max = Math.max(...snaps.map((x) => x.priceDkk));
                      const min = Math.min(...snaps.map((x) => x.priceDkk));
                      const h = 12 + ((s.priceDkk - min) / (max - min || 1)) * 88;
                      return (
                        <div key={s.id} className="flex flex-1 flex-col items-center gap-1" title={`${formatDkk(s.priceDkk)} · ${formatDateTime(s.observedAt)}`}>
                          <span className="mono text-[9px] text-dim">{formatDkk(s.priceDkk)}</span>
                          <div className="w-full rounded-t bg-accent/70" style={{ height: `${h}%` }} />
                          <span className="mono text-[9px] text-dim">{formatDate(s.observedAt).slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {priceDelta !== 0 && (
                    <p className={`mono mt-2 text-[12px] ${priceDelta < 0 ? "text-good" : "text-warn"}`}>
                      {priceDelta < 0 ? `📉 ${formatDkk(Math.abs(priceDelta))} ned siden første måling` : `📈 ${formatDkk(priceDelta)} op siden første måling`}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">💬 Make Offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11.5px] text-dim">
                Forslagene er beregnet ud fra markedsværdi, alder og tilstand. Intet sendes automatisk — du bestemmer.
              </p>
              <OfferBuilder
                offers={offers.map((o) => `${o.label} · ${formatDkk(o.amount)} (${o.deltaFromAsking >= 0 ? "+" : ""}${o.deltaFromAsking} kr vs. pris)\n${o.message}`)}
                productLabel={l.title}
                priceDkk={l.priceDkk}
              />
              {points.length > 0 && (
                <div className="rounded-md border border-line bg-panel-2 p-2.5">
                  <div className="eyebrow">💡 Forhandlingsargumenter</div>
                  <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted">
                    {points.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">💸 Flip-beregner</CardTitle>
            </CardHeader>
            <CardContent>
              <FlipCalculator
                listingId={l.id}
                productLabel={l.title}
                buyPrice={l.priceDkk}
                quickSaleDkk={l.quickSaleValueDkk}
                maxBuyDkk={maxBuy}
                defaultTargetSale={targetSale}
                feePct={settings.flip.platformFeePct}
                transportDkk={settings.flip.transportDkk}
                repairDkk={settings.flip.repairAllowanceDkk}
              />
              {flip && (
                <p className="mono mt-2 text-[11.5px] text-dim">
                  📌 Allerede i 💸 Flips ({flip.status}) · 🪙 {formatDkk(flip.purchasePriceDkk)} → 💰{" "}
                  {flip.salePriceDkk !== null ? formatDkk(flip.salePriceDkk) : "—"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">
                ✅ {l.productType === "macbook" ? "MacBook" : "iPhone"}-tjekliste før køb
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Checklist items={checklist} />
              <p className="mt-2 text-[11px] text-dim">
                {l.productType === "macbook" ? MACBOOK_CHECKLIST.length : IPHONE_CHECKLIST.length} punkter.
                Find My og IMEI er de to, der ødelægger flest køb.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[13px]">🎯 Vurdering</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mono text-[34px] font-bold leading-none text-ink">{l.dealScore}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <TierBadge tier={l.dealTier} />
                <VelocityBadge level={l.velocityLevel} />
                <RiskBadge level={l.riskLevel} score={l.riskScore} />
                <JustListedBadge ageMin={l.ageMin} />
              </div>
              <dl className="mono mt-3 space-y-1 text-[11.5px]">
                <Row label="💰 Pris" value={formatDkk(l.priceDkk)} />
                <Row label="📊 Markedsværdi" value={l.marketValueDkk !== null ? formatDkk(l.marketValueDkk) : "—"} />
                <Row
                  label="🎯 Rabat"
                  value={formatPct(l.discountPct)}
                  tone={(l.discountPct ?? 0) >= 15 ? "good" : (l.discountPct ?? 0) < 0 ? "danger" : "default"}
                />
                <Row
                  label="💰 Netto profit"
                  value={l.netProfitDkk !== null ? formatDkk(l.netProfitDkk) : "—"}
                  tone={(l.netProfitDkk ?? 0) >= 0 ? "good" : "danger"}
                />
                <Row label="📈 ROI" value={formatPct(l.roiPct)} />
                <Row label="⚡ Hurtigt salg" value={l.quickSaleValueDkk !== null ? formatDkk(l.quickSaleValueDkk) : "—"} />
                <Row label="🚫 Foreslået makspris" value={maxBuy !== null ? formatDkk(maxBuy) : "—"} />
                <Row label="⏱ Dage online" value={formatNumber(daysListed)} />
                <Row label="🔢 Målinger" value={formatNumber(l.snapshotCount)} />
                <Row label="📍 Afstand" value={l.distanceKm !== null ? `${formatNumber(l.distanceKm)} km` : "—"} />
                <Row label="🏪 Markedsplads" value={mpName} />
                <Row label="🔋 Batteri" value={l.batteryHealth !== null ? `${l.batteryHealth}%` : "—"} />
                <Row label="💾 Lager" value={l.storageGb !== null ? `${l.storageGb} GB` : "—"} />
                <Row label="🧠 RAM" value={l.ramGb !== null ? `${l.ramGb} GB` : "—"} />
                <Row label="🎨 Farve" value={l.color ?? "—"} />
                <Row label="🧾 Tilstand" value={l.condition ?? "—"} />
                <Row label="🔍 Parse-konfidens" value={`${l.parseConfidence}%${l.parseAmbiguous ? " (tvetydig)" : ""}`} />
              </dl>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <ConfidenceBadge confidence={l.estimateConfidence} sample={l.estimateSample} />
                {l.aiParsed && <AiParsedBadge />}
                {l.hiddenGemScore >= 35 && <HiddenGemBadge />}
              </div>
            </CardContent>
          </Card>

          {factors.components && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px]">🔬 Hvad driver scoren</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="mono space-y-0.5 text-[11.5px]">
                  {Object.entries(factors.components).map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="text-muted">{k}</span>
                      <span className={Number(v) >= 0 ? "text-good" : "text-danger"}>
                        {Number(v) > 0 ? "+" : ""}
                        {Number(v).toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
                {factors.penalty ? (
                  <p className="mono mt-1.5 text-[11.5px] text-danger">🛡 Risikostraf −{Number(factors.penalty).toFixed(1)}</p>
                ) : null}
                {factors.estimateBasis && (
                  <p className="mt-1.5 text-[11px] text-dim">📐 Estimationsgrundlag: {factors.estimateBasis}</p>
                )}
              </CardContent>
            </Card>
          )}

          {detail.signals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px]">🛡 Risikosignaler ({detail.signals.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-line">
                  {detail.signals.map((s, i) => (
                    <li key={i} className="px-3 py-2">
                      <div
                        className={`text-[12px] ${
                          s.severity === "high" ? "text-danger" : s.severity === "medium" ? "text-warn" : "text-muted"
                        }`}
                      >
                        {s.phrase ?? s.code}
                      </div>
                      {s.detail && <div className="mt-0.5 text-[11px] text-dim">{s.detail}</div>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {comps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px]">📊 Sammenlignelige ({comps.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-line">
                  {comps.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-[11.5px]">
                      <Link href={`/listings/${c.id}`} className="min-w-0 flex-1 truncate text-accent hover:underline">
                        {c.title}
                      </Link>
                      <OriginBadge origin={c.origin} />
                      <span className={`mono w-20 text-right ${c.priceDkk < l.priceDkk ? "text-good" : "text-dim"}`}>
                        {formatDkk(c.priceDkk)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {detail.originBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[13px]">🔗 Datagrundlag for estimatet</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="mono space-y-0.5 text-[11.5px]">
                  {detail.originBreakdown.map((o) => (
                    <li key={o.origin} className="flex justify-between">
                      <span className="text-dim">
                        {o.origin === "DEMO" ? "⚪ DEMO" : o.origin === "IMPORTED" ? "🔵 IMPORTED" : `🟢 ${o.origin}`}
                      </span>
                      <span className="text-ink">{o.count} obs.</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  const c = tone === "good" ? "text-good" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-dim">{label}</dt>
      <dd className={`text-right ${c}`}>{value}</dd>
    </div>
  );
}
