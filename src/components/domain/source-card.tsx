"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, FlaskConical, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toneClass } from "./badges";

export interface SourceCardData {
  key: string;
  name: string;
  accessStatus: string;
  accessMode: string;
  detail: string;
  requirements: string[];
  enabled: boolean;
  canSync: boolean;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  listingCount: number;
  docsUrl?: string;
}

export function SourceCard({ s }: { s: SourceCardData }) {
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">{s.name}</h3>
          <p className="mono mt-0.5 text-[11px] uppercase tracking-wide text-dim">{s.accessMode}</p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-[11px] font-medium ${toneClass(
            s.accessStatus === "LIVE" ? "live" : s.accessStatus === "LIMITED" ? "limited" : s.accessStatus === "MANUAL" ? "manual" : "unavailable"
          )}`}
        >
          {s.accessStatus === "LIVE" ? "🟢 LIVE" : s.accessStatus === "LIMITED" ? "🟡 LIMITED" : s.accessStatus === "MANUAL" ? "📥 MANUAL IMPORT" : "⚪ UNAVAILABLE"}
        </span>
      </div>

      <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{s.detail}</p>

      {s.requirements.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11.5px] text-dim">
          {s.requirements.map((r, i) => (
            <li key={i}>→ {r}</li>
          ))}
        </ul>
      )}

      <div className="mono mt-3 flex flex-wrap items-center gap-3 text-[11px] text-dim">
        <span>🆕 fund: {s.listingCount}</span>
        <span>🔄 sidst: {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString("da-DK") : "aldrig"}</span>
        {s.lastSyncError && <span className="text-danger">⛔ {s.lastSyncError}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {s.canSync && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await fetch("/api/sources", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "sync", key: s.key }),
              });
              const data = (await res.json()) as { result?: { fetched: number; error?: string } };
              setMsg(data.result?.error ?? `Hentede ${data.result?.fetched ?? 0}`);
              setBusy(false);
              router.refresh();
            }}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Synkronisér
          </Button>
        )}
        {s.docsUrl && (
          <a
            href={s.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-line bg-panel-2 px-2 py-1 text-[11.5px] text-muted transition-colors hover:text-ink"
          >
            📄 Dokumentation
          </a>
        )}
        {s.key === "demo" && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await fetch("/api/sources", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "demo-seed" }),
                });
                const data = (await res.json()) as { count?: number };
                setMsg(`${data.count ?? 0} DEMO-records genopdateret`);
                setBusy(false);
                router.refresh();
              }}
            >
              <FlaskConical size={13} /> Generer DEMO
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await fetch("/api/sources", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ action: "demo-clear" }),
                });
                const data = (await res.json()) as { count?: number };
                setMsg(`${data.count ?? 0} DEMO-records fjernet`);
                setBusy(false);
                router.refresh();
              }}
            >
              <Trash2 size={13} /> Slet DEMO
            </Button>
          </>
        )}
        {msg && <span className="text-[11px] text-muted">{msg}</span>}
      </div>
    </div>
  );
}
