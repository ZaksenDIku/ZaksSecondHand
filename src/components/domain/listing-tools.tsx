"use client";

import * as React from "react";
import { Check, Copy, AlertTriangle } from "lucide-react";

export function Checklist({ items }: { items: { label: string; ok: boolean }[] }) {
  const [done, setDone] = React.useState<Record<number, boolean>>({});
  const total = items.length;
  const passed = items.filter((i, idx) => i.ok || done[idx]).length;
  const pct = total ? Math.round((passed / total) * 100) : 0;
  const tone = pct >= 80 ? "text-good" : pct >= 50 ? "text-warn" : "text-danger";

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11.5px] text-muted">✅ {passed}/{total} punkter bestået</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
          <span
            className={`block h-full ${pct >= 80 ? "bg-good" : pct >= 50 ? "bg-warn" : "bg-danger"}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className={`mono text-[12px] font-semibold ${tone}`}>{pct}%</span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((item, i) => {
          const ok = item.ok || !!done[i];
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors ${
                  ok ? "border-good/30 bg-good/8 text-good" : "border-line bg-panel text-muted hover:border-line-2"
                }`}
              >
                <span className={ok ? "text-good" : "text-dim"}>
                  {ok ? <Check size={12} /> : <AlertTriangle size={12} />}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.ok && <span className="text-[10px] text-dim">auto</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OfferBuilder({ offers, productLabel, priceDkk }: { offers: string[]; productLabel: string; priceDkk: number }) {
  const [picked, setPicked] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <p className="text-[11.5px] text-dim">
        Forslag baseret på {formatDkkLocal(priceDkk)} og beregnet markedsværdi. Du bestemmer selv det endelige tal —
        brug dem som udgangspunkt, ikke som lovbud.
      </p>
      {offers.map((o, i) => (
        <div
          key={i}
          className={`rounded-md border px-2.5 py-2 ${
            picked === i ? "border-accent/60 bg-accent/8" : "border-line bg-panel"
          }`}
        >
          <p className="text-[12.5px] text-ink">{o}</p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPicked(i);
                navigator.clipboard?.writeText(`${o}\n\n— angående ${productLabel}`).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink"
            >
              {copied && picked === i ? <Check size={10} className="text-good" /> : <Copy size={10} />}
              {copied && picked === i ? "Kopieret" : "Kopiér"}
            </button>
            <button
              type="button"
              onClick={() => setPicked(i)}
              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted hover:text-ink"
            >
              Vælg
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDkkLocal(n: number): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(n);
}
