"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Link2, FileText, Braces, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {Textarea, Input} from "@/components/ui/input";

type Mode = "url" | "text" | "csv" | "json" | "email";

const MODES: { value: Mode; label: string; icon: React.ReactNode; hint: string; placeholder: string }[] = [
  {
    value: "url",
    label: "🔗 Enkelt annonce-URL",
    icon: <Link2 size={14} />,
    hint: "DBA: vi henter kun den side du selv indsætter og læser indlejret metadata. Facebook/Vinted kan ikke hentes automatisk.",
    placeholder: "https://www.dba.dk/…",
  },
  {
    value: "text",
    label: "📝 Søgnings-alert (fritekst)",
    icon: <FileText size={14} />,
    hint: "Indsæt hele alert-teksten fra en markedspladssøgning. Pris, model og link udledes automatisk.",
    placeholder: "iPhone 16 Pro 256GB\n4.100 kr\nKøbenhavn K\nhttps://…",
  },
  {
    value: "csv",
    label: "📄 CSV",
    icon: <FileText size={14} />,
    hint: "Påkrævede kolonner: title, price. Anbefalet: url, description, location, posted, storage, ram, battery, seller.",
    placeholder: "title,price,url,location\niPhone 16 Pro 256GB,4100,https://…,København",
  },
  {
    value: "json",
    label: "🧩 JSON",
    icon: <Braces size={14} />,
    hint: "Array af objekter eller { \"listings\": [...] } med title/price og valgfri øvrige felter.",
    placeholder: '[{"title":"iPhone 16 Pro 256GB","price":4100,"url":"https://…"}]',
  },
  {
    value: "email",
    label: "📧 E-mail-alert",
    icon: <Mail size={14} />,
    hint: "Videresend en e-mail fra en markedspladssøgning. HTML og kviktræk filtreres fra.",
    placeholder: "Fra: no-reply@…\nEmne: 3 nye resultater\n…",
  },
];

/** Attribution choices for imports that carry no marketplace link. */
const MARKETPLACES = [
  { value: "", label: "Ukendt / manuel" },
  { value: "dba", label: "DBA" },
  { value: "guloggratis", label: "Gul & Gratis" },
  { value: "facebook", label: "Facebook Marketplace" },
  { value: "vinted", label: "Vinted" },
  { value: "trendsales", label: "TrendSales" },
  { value: "shp", label: "Shopify / eget websted" },
  { value: "email", label: "E-mail-alert" },
];

export function ImportForm() {
  const [mode, setMode] = React.useState<Mode>("text");
  const [payload, setPayload] = React.useState("");
  const [marketplace, setMarketplace] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    error?: string;
    parsed?: number;
    created?: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);
  const router = useRouter();
  const active = MODES.find((m) => m.value === mode)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, payload, marketplace }),
      });
      const data = await res.json();
      setResult(data);
      if (res.ok) {
        setPayload("");
        router.refresh();
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Ukendt fejl" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              setMode(m.value);
              setResult(null);
              // URL imports prove the marketplace themselves.
              if (m.value === "url") setMarketplace("");
            }}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
              mode === m.value
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-line bg-panel text-muted hover:border-line-2 hover:text-ink"
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-dim">{active.hint}</p>

      {mode === "url" ? (
        <Input
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder={active.placeholder}
          required
        />
      ) : (
        <Textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder={active.placeholder}
          rows={9}
          className="mono text-[12px]"
          required
        />
      )}

      {mode !== "url" && (
        <label className="block text-[12px] text-muted">
          Markedsplads
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
          >
            {MARKETPLACES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-dim">
            Bruges til oprindelse og kildestatistik. Et link i payloaden overrides dette felt.
          </span>
        </label>
      )}

      {mode === "csv" && (
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted">
          <Upload size={13} /> Vælg CSV-fil
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setPayload(await file.text());
            }}
          />
        </label>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy || payload.trim() === ""}>
          {busy ? "Importerer…" : "📥 Importér"}
        </Button>
        <span className="text-[11px] text-dim">
          Alt importeres gennem samme normalisering, prisberegning, DealScore, RiskScore og dubletkontrol.
        </span>
      </div>

      {result && (
        <div
          className={`rounded-lg border px-3 py-2.5 text-[12.5px] ${
            result.ok ? "border-good/40 bg-good/10 text-good" : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {result.ok ? (
            <>
              ✅ Importeret {result.created} nye og opdateret {result.updated} annoncer
              {typeof result.skipped === "number" && result.skipped > 0 ? ` (${result.skipped} sprunget over)` : ""}.
            </>
          ) : (
            <>⛔ {result.error ?? "Importen mislykkedes"}</>
          )}
          {result.errors && result.errors.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-muted">
              {result.errors.slice(0, 8).map((e, i) => (
                <li key={i}>⚠️ {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
