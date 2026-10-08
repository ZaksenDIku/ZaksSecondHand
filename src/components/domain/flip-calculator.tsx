"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {Save, Play} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDkk, formatPct } from "@/lib/core/format";

interface FlipCalcProps {
  listingId: string;
  productLabel: string;
  buyPrice: number;
  quickSaleDkk: number | null;
  maxBuyDkk: number | null;
  defaultTargetSale: number;
  feePct: number;
  transportDkk: number;
  repairDkk: number;
}

export function FlipCalculator(props: FlipCalcProps) {
  const [buy, setBuy] = React.useState(props.buyPrice);
  const [sale, setSale] = React.useState(props.defaultTargetSale);
  const [fee, setFee] = React.useState(props.feePct);
  const [transport, setTransport] = React.useState(props.transportDkk);
  const [repair, setRepair] = React.useState(props.repairDkk);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const router = useRouter();

  const feeDkk = (sale * fee) / 100;
  const net = sale - feeDkk - transport - repair;
  const profit = net - buy;
  const roi = buy > 0 ? (profit / buy) * 100 : 0;
  const marginOk = roi >= 15;
  const overBudget = props.maxBuyDkk !== null && buy > props.maxBuyDkk;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <Label htmlFor="fc-buy">🪙 Købspris</Label>
          <Input id="fc-buy" type="number" value={buy} onChange={(e) => setBuy(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="fc-sale">💰 Forventet salgspris</Label>
          <Input id="fc-sale" type="number" value={sale} onChange={(e) => setSale(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="fc-fee">Platformgebyr (%)</Label>
          <Input id="fc-fee" type="number" step="0.5" value={fee} onChange={(e) => setFee(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="fc-tr">🚚 Transport</Label>
          <Input id="fc-tr" type="number" value={transport} onChange={(e) => setTransport(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="fc-rep">🔧 Reparation</Label>
          <Input id="fc-rep" type="number" value={repair} onChange={(e) => setRepair(Number(e.target.value))} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Box label="💸 Netto efter omkostninger" value={formatDkk(net)} />
        <Box label="📈 Forventet profit" value={formatDkk(profit)} tone={profit >= 0 ? "good" : "danger"} />
        <Box label="📊 ROI" value={formatPct(roi)} tone={marginOk ? "good" : "warn"} />
        <Box
          label="⚡ Øvrige købsmuligheder"
          value={props.quickSaleDkk !== null ? `💸 ${formatDkk(props.quickSaleDkk)} hurtigt salg` : "—"}
        />
      </div>

      {props.maxBuyDkk !== null && (
        <p className={`mt-2 text-[12px] ${overBudget ? "text-danger" : "text-dim"}`}>
          {overBudget
            ? `⛔ Prisen er ${formatDkk(buy - props.maxBuyDkk)} over din beregnede makspris (${formatDkk(props.maxBuyDkk)}).`
            : `✅ Under beregnet makspris ${formatDkk(props.maxBuyDkk)} — baseret på ${formatDkk(props.quickSaleDkk ?? 0)} hurtigt salg.`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch("/api/flips", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                listingId: props.listingId,
                productLabel: props.productLabel,
                purchasePriceDkk: buy,
                targetSaleDkk: sale,
                status: "PURCHASED",
              }),
            });
            const d = (await res.json()) as { error?: string };
            setMsg(res.ok ? "✅ Køb registreret under 💸 Flips" : `⛔ ${d.error ?? "fejl"}`);
            setBusy(false);
            router.refresh();
          }}
        >
          <Play size={12} /> {busy ? "Gemmer…" : "💸 Forbind som køb"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch("/api/flips", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                listingId: props.listingId,
                productLabel: props.productLabel,
                targetSaleDkk: sale,
                status: "INTERESTED",
              }),
            });
            const d = (await res.json()) as { error?: string };
            setMsg(res.ok ? "💡 Følger med under 💸 Flips" : `⛔ ${d.error ?? "fejl"}`);
            setBusy(false);
            router.refresh();
          }}
        >
          <Save size={12} /> 💡 Følg med
        </Button>
        {msg && <span className="text-[12px] text-muted">{msg}</span>}
      </div>
    </div>
  );
}

function Box({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  const c = tone === "good" ? "text-good" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`mono mt-0.5 text-[15px] font-bold ${c}`}>{value}</div>
    </div>
  );
}
