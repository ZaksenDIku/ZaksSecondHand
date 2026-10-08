"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const PRODUCTS = [
  { value: "iphone", label: "Alle iPhones" },
  { value: "iphone_16", label: "iPhone 16" },
  { value: "iphone_15", label: "iPhone 15" },
  { value: "iphone_14", label: "iPhone 14" },
  { value: "macbook", label: "Alle MacBooks" },
  { value: "m3", label: "M3" },
  { value: "m2", label: "M2" },
  { value: "m1", label: "M1" },
];

export function WatchRuleForm({ compact = false }: { compact?: boolean }) {
  const [label, setLabel] = React.useState("");
  const [productType, setProductType] = React.useState("iphone");
  const [maxPrice, setMaxPrice] = React.useState("");
  const [minScore, setMinScore] = React.useState("");
  const [minProfit, setMinProfit] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(!compact);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          label: label || "Ny regel",
          productType: productType === "all" ? null : productType,
          maxPriceDkk: maxPrice ? Number(maxPrice) : null,
          minDealScore: minScore ? Number(minScore) : null,
          minProfitDkk: minProfit ? Number(minProfit) : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke oprette regel");
      setLabel("");
      setMaxPrice("");
      setMinScore("");
      setMinProfit("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukendt fejl");
    } finally {
      setBusy(false);
    }
  }

  if (compact && !open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus size={13} /> Ny regel
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink">Ny watch-regel</h2>
        {compact && (
          <button type="button" onClick={() => setOpen(false)} className="text-dim hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <Label htmlFor="wr-label">Navn</Label>
          <Input
            id="wr-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Fx “iPhone 16 Pro ≤ 6.500 kr”"
          />
        </div>
        <div>
          <Label htmlFor="wr-product">Model</Label>
          <Select id="wr-product" value={productType} onChange={(e) => setProductType(e.target.value)}>
            <option value="all">Alle produkter</option>
            {PRODUCTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="wr-max">Maks pris (kr)</Label>
          <Input
            id="wr-max"
            type="number"
            min={0}
            step={250}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="6500"
          />
        </div>
        <div>
          <Label htmlFor="wr-score">Min deal score</Label>
          <Input
            id="wr-score"
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="80"
          />
        </div>
        <div>
          <Label htmlFor="wr-profit">Min profit (kr)</Label>
          <Input
            id="wr-profit"
            type="number"
            min={0}
            step={100}
            value={minProfit}
            onChange={(e) => setMinProfit(e.target.value)}
            placeholder="800"
          />
        </div>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      <div className="mt-3">
        <Button type="submit" size="sm" variant="primary" disabled={busy}>
          {busy ? "Gemmer…" : "Opret regel"}
        </Button>
      </div>
    </form>
  );
}

export function WatchRuleDelete({ id }: { id: string }) {
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={busy}
      title="Slet regel"
      onClick={async () => {
        setBusy(true);
        await fetch("/api/watch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "delete", id }),
        });
        setBusy(false);
        router.refresh();
      }}
      className="rounded p-1 text-dim transition-colors hover:bg-danger/10 hover:text-danger"
    >
      <Trash2 size={13} />
    </button>
  );
}
