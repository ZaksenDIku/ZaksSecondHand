"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const KINDS = [
  { value: "deal_score", label: "DealScore over …", threshold: 85, unit: "score" },
  { value: "discount", label: "Rabat under markedpris over …", threshold: 20, unit: "%" },
  { value: "profit", label: "Estimeret profit over …", threshold: 1000, unit: "kr" },
  { value: "price_below", label: "Pris under …", threshold: 5000, unit: "kr" },
];

export function AlertRuleForm() {
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState("deal_score");
  const [threshold, setThreshold] = React.useState("85");
  const [productType, setProductType] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  const meta = KINDS.find((k) => k.value === kind)!;

  return (
    <form
      className="panel p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/alerts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "create",
              name: name || meta.label,
              kind,
              threshold: Number(threshold),
              productType: productType || null,
            }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? "Kunne ikke oprette regel");
          setName("");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ukendt fejl");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Bell size={14} className="text-accent" />
        <h2 className="text-[13px] font-semibold text-ink">Ny alarmregel</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <Label htmlFor="ar-name">Navn</Label>
          <Input id="ar-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx “Pro-modeller under 5.000 kr”" />
        </div>
        <div>
          <Label htmlFor="ar-kind">Udløser ved</Label>
          <Select
            id="ar-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              const k = KINDS.find((x) => x.value === e.target.value);
              if (k) setThreshold(String(k.threshold));
            }}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ar-threshold">Tærskel ({meta.unit})</Label>
          <Input id="ar-threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ar-product">Produkt</Label>
          <Select id="ar-product" value={productType} onChange={(e) => setProductType(e.target.value)}>
            <option value="">Alle produkter</option>
            <option value="iphone">📱 Kun iPhone</option>
            <option value="macbook">💻 Kun MacBook</option>
          </Select>
        </div>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      <div className="mt-3">
        <Button type="submit" size="sm" variant="primary" disabled={busy}>
          <Plus size={13} /> {busy ? "Opretter…" : "Opret regel"}
        </Button>
      </div>
    </form>
  );
}

export function AlertRuleActions({ id, enabled }: { id: string; enabled: boolean }) {
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  async function call(action: string) {
    setBusy(true);
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, id, enabled: !enabled }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => call("toggle")}
        className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-muted transition-colors hover:text-ink"
      >
        {enabled ? "⏸ Pause" : "▶ Aktiv"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => call("delete")}
        className="rounded p-1 text-dim transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function TestChannelsButton() {
  const [state, setState] = React.useState<"idle" | "busy" | "done">("idle");
  const [result, setResult] = React.useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const res = await fetch("/api/alerts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "test" }),
          });
          const data = (await res.json()) as { results?: Record<string, { ok?: boolean; detail?: string; reason?: string }> };
          setResult(
            Object.entries(data.results ?? {})
              .map(([k, v]) => `${k}: ${v.ok === false ? `fejl (${v.detail ?? v.reason})` : "ok"}`)
              .join(" · ")
          );
          setState("done");
        }}
      >
        🧪 Test kanaler
      </Button>
      {result && <span className="text-[11px] text-dim">{result}</span>}
    </div>
  );
}
