import { ensureBootstrap } from "@/lib/db/bootstrap";
import { getFlips } from "@/lib/db/queries";
import { getAppSettings } from "@/lib/db/settings";
import { FlipForm, FlipRowActions } from "@/components/domain/flip-forms";
import { PageHeader, OriginLegend } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OriginBadge, toneClass } from "@/components/domain/badges";
import { FLIP_STATUS_META, type FlipStatus } from "@/lib/core/flip";
import { formatDkk, formatPct, formatDate, formatNumber } from "@/lib/core/format";

export const dynamic = "force-dynamic";

export default async function FlipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await ensureBootstrap();
  const sp = await searchParams;
  const rows = getFlips();
  const settings = getAppSettings();
  const openForm = sp.new === "1";

  const totals = {
    invested: rows.reduce((s, f) => s + f.purchasePriceDkk + f.expensesDkk, 0),
    profit: rows.filter((f) => f.salePriceDkk !== null).reduce((s, f) => s + (f.profit ?? 0), 0),
    sold: rows.filter((f) => f.salePriceDkk !== null).length,
    avgRoi: (() => {
      const closed = rows.filter((f) => f.roi !== null);
      return closed.length ? closed.reduce((s, f) => s + (f.roi ?? 0), 0) / closed.length : 0;
    })(),
    avgHold: (() => {
      const closed = rows.filter((f) => f.saleDate);
      return closed.length ? Math.round(closed.reduce((s, f) => s + f.daysHeld, 0) / closed.length) : 0;
    })(),
  };

  return (
    <>
      <PageHeader
        title="💸 Flips"
        subtitle="Hold styr på hver videresalg fra første kontakt til endelig salg. Profit og ROI beregnes automatisk fra købspris, omkostninger og salgspris."
        originNote={<OriginLegend />}
        actions={<FlipForm open={openForm} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Stat emoji="🛒" label="Kapital investeret" value={formatDkk(totals.invested)} />
        <Stat emoji="💰" label="Samlet profit" value={formatDkk(totals.profit)} tone={(totals.profit ?? 0) >= 0 ? "good" : "danger"} />
        <Stat emoji="📈" label="Gennemsnitlig ROI" value={formatPct(totals.avgRoi, 1)} tone={(totals.avgRoi ?? 0) >= 0 ? "good" : "danger"} />
        <Stat emoji="⏱" label="Gennemsnitlig holdetid" value={`${formatNumber(totals.avgHold)} dage`} />
        <Stat emoji="✅" label="Afsluttede flips" value={formatNumber(totals.sold)} />
        <Stat
          emoji="📦"
          label="Åbne deals"
          value={formatNumber(rows.length - totals.sold)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">{rows.length} flip-poster</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Ingen flips endnu"
                description="Registrer det første køb, så profit, ROI og holdetid beregnes automatisk. Du kan også starte fra en annonce via “Købt”-knappen."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((f) => {
                const meta = FLIP_STATUS_META[(f.status as FlipStatus) ?? "CONTACTED"] ?? FLIP_STATUS_META.CONTACTED;
                const sold = f.salePriceDkk !== null;
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${toneClass(meta.tone)}`}>
                      {meta.emoji} {meta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] text-ink">{f.productLabel}</div>
                      <div className="mono text-[11px] text-dim">
                        🪙 {formatDkk(f.purchasePriceDkk)} + {formatDkk(f.expensesDkk)} omkostninger · 🛒{" "}
                        {f.purchaseMarketplace ?? "ukendt"} · 📅 {formatDate(f.purchaseDate)}
                        {f.offerDkk ? ` · 🤝 tilbud ${formatDkk(f.offerDkk)}` : ""}
                      </div>
                    </div>
                    <OriginBadge origin={f.origin} />
                    <div className="mono w-40 text-right">
                      {sold ? (
                        <>
                          <div className="text-[13px] font-semibold text-good">💸 {formatDkk(f.profit ?? 0)}</div>
                          <div className="text-[11px] text-dim">
                            📈 {formatPct(f.roi)} · ⏱ {f.daysHeld} dage
                          </div>
                        </>
                      ) : (
                        <div className="text-[12px] text-dim">beregningsgrundlag: {formatDkk(f.purchasePriceDkk + f.expensesDkk)}</div>
                      )}
                    </div>
                    <FlipRowActions id={f.id} status={f.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-3 text-[11px] text-dim">
        Standardomkostninger i flip-beregningen: {settings.flip.platformFeePct} % gebyr,{" "}
        {formatDkk(settings.flip.transportDkk)} kr transport, {formatDkk(settings.flip.repairAllowanceDkk)} kr
        reparationsreserve. Kan ændres under ⚙️ Settings.
      </p>
    </>
  );
}

function Stat({ emoji, label, value, tone = "default" }: { emoji: string; label: string; value: string; tone?: string }) {
  const color = tone === "good" ? "text-good" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-dim">
        {emoji} {label}
      </div>
      <div className={`mono mt-1 text-[16px] font-bold ${color}`}>{value}</div>
    </div>
  );
}
