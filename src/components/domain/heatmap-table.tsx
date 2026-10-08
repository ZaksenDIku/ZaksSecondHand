"use client";

import * as React from "react";
import Link from "next/link";
import { Table, THead, TH, TR, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDkk, formatPct } from "@/lib/core/format";
import { ConfidenceBadge } from "./badges";
import type { HeatmapEntry } from "@/lib/view-types";

type Metric = "median" | "cheapest" | "buyBelow" | "stealBelow" | "trend30Pct" | "count";

const METRICS: { value: Metric; label: string; hint: string }[] = [
  { value: "median", label: "Median pris", hint: "Median af alle observerede priser for konfigurationen" },
  { value: "cheapest", label: "Billigste fund", hint: "Laveste pris i datasættet (kan være en usædvanlig annonce)" },
  { value: "buyBelow", label: "Køb under", hint: "pris for 15 % rabat på medianen" },
  { value: "stealBelow", label: "Steal under", hint: "pris for 25 % rabat på medianen" },
  { value: "trend30Pct", label: "30 dages trend", hint: "Ændring i medianpris over de seneste 30 dage" },
  { value: "count", label: "Antal fund", hint: "Så mange observationer ligger bag estimatet" },
];

export function HeatmapTable({
  entries,
  productType,
  query,
}: {
  entries: HeatmapEntry[];
  productType: string;
  query: string;
}) {
  const [metric, setMetric] = React.useState<Metric>("median");
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = (q || query).trim().toLowerCase();
    return entries.filter((e) => !needle || e.label.toLowerCase().includes(needle));
  }, [entries, q, query]);

  const models = React.useMemo(() => {
    const map = new Map<string, Set<number | null>>();
    for (const e of filtered) {
      const set = map.get(e.label) ?? new Set<number | null>();
      set.add(e.storageGb);
      map.set(e.label, set);
    }
    return [...map.entries()]
      .map(([label, storages]) => ({
        label,
        storages: [...storages].sort((a, b) => (a ?? 0) - (b ?? 0)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered]);

  const byKey = React.useMemo(
    () => new Map(filtered.map((e) => [`${e.label}|${e.storageGb ?? "?"}`, e])),
    [filtered]
  );

  const { min, max } = React.useMemo(() => {
    const values = filtered
      .map((e) => valueFor(e, metric))
      .filter((v): v is number => v !== null);
    if (values.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [filtered, metric]);

  const active = METRICS.find((m) => m.value === metric)!;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMetric(m.value)}
              className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                metric === m.value
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-line bg-panel text-muted hover:border-line-2 hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrér model…"
          className="h-7 w-40 rounded-md border border-line bg-panel-2 px-2 text-[12px] text-ink outline-none placeholder:text-dim focus:border-line-2"
        />
        <span className="text-[11.5px] text-dim">{active.hint}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <Table>
          <THead>
            <TR>
              <TH className="sticky left-0 z-10 bg-panel-2">Model</TH>
              {storagesOf(models).map((s) => (
                <TH key={s ?? "all"} className="text-right">
                  {s ? `${s} GB` : "—"}
                </TH>
              ))}
            </TR>
          </THead>
          <tbody>
            {models.map((m) => (
              <TR key={m.label}>
                <td className="sticky left-0 z-10 bg-panel px-3 py-1.5 text-[12.5px] text-ink">{m.label}</td>
                {storagesOf(models).map((s) => {
                  const e = byKey.get(`${m.label}|${s ?? "?"}`);
                  if (!e) return <TD key={s ?? "all"} className="bg-panel" />;
                  const v = valueFor(e, metric);
                  const intensity = heat(v, min, max, metric);
                  return (
                    <TD key={s ?? "all"} className="text-right">
                      <Link
                        href={`/live?q=${encodeURIComponent(e.label)}`}
                        className="mono block rounded px-1.5 py-1 text-[12px] transition-colors hover:bg-panel-3"
                        style={intensity ? { background: intensity } : undefined}
                      >
                        {render(v, metric)}
                      </Link>
                    </TD>
                  );
                })}
              </TR>
            ))}
            {models.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-[12.5px] text-dim">
                  Ingen konfigurationer matcher {productType}.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-dim">
        <span>Datagrundlag: {filtered.reduce((s, e) => s + e.sampleCount, 0)} prisobservationer</span>
        {filtered.some((e) => e.confidence === "LOW" || e.confidence === "NONE") && (
          <span>
            <Badge tone="warn">Lav tillid</Badge> felter har for få observationer til at konkludere noget
          </span>
        )}
      </div>
    </div>
  );
}

function storagesOf(models: { storages: (number | null)[] }[]): (number | null)[] {
  const set = new Set<number | null>();
  for (const m of models) for (const s of m.storages) set.add(s);
  return [...set].sort((a, b) => (a ?? 0) - (b ?? 0));
}

function valueFor(e: HeatmapEntry, metric: Metric): number | null {
  switch (metric) {
    case "median":
      return e.median;
    case "cheapest":
      return e.cheapest;
    case "buyBelow":
      return e.buyBelow;
    case "stealBelow":
      return e.stealBelow;
    case "trend30Pct":
      return e.trend30Pct;
    case "count":
      return e.sampleCount;
  }
}

function render(v: number | null, metric: Metric) {
  if (v === null) return "—";
  if (metric === "count") return String(v);
  if (metric === "trend30Pct")
    return (
      <span className={v >= 0 ? "text-good" : "text-steel"}>
        {v >= 0 ? "+" : ""}
        {formatPct(v, 0)}
      </span>
    );
  return formatDkk(v);
}

/** Green = cheap relative to the column range, red = expensive. */
function heat(v: number | null, min: number, max: number, metric: Metric): string | undefined {
  if (v === null || max === min) return undefined;
  if (metric === "trend30Pct" || metric === "count") return undefined;
  const t = (v - min) / (max - min);
  const alpha = 0.06 + (1 - t) * 0.16;
  return t > 0.66
    ? `rgba(255, 77, 61, ${alpha.toFixed(3)})`
    : t < 0.33
      ? `rgba(47, 209, 128, ${alpha.toFixed(3)})`
      : "transparent";
}

export { ConfidenceBadge };
