"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FLIP_STATUSES, type FlipStatus } from "@/lib/core/flip";

export function FlipForm({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const [productLabel, setProductLabel] = React.useState("");
  const [purchasePrice, setPurchasePrice] = React.useState("");
  const [expenses, setExpenses] = React.useState("");
  const [purchaseDate, setPurchaseDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [marketplace, setMarketplace] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [visible, setVisible] = React.useState(open ?? false);
  const [openRef, setOpenRef] = React.useState(open);
  const router = useRouter();

  // Follow the `open` prop during render rather than in an effect, so a
  // `?new=1` link opens the form without a second render pass.
  if (open !== openRef) {
    setOpenRef(open);
    setVisible(open ?? false);
  }

  if (!visible) {
    return (
      <Button size="sm" variant="primary" onClick={() => setVisible(true)}>
        💸 Registrer køb
      </Button>
    );
  }

  return (
    <form
      className="panel p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/flips", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "create",
              productLabel,
              purchasePriceDkk: Number(purchasePrice),
              expensesDkk: expenses ? Number(expenses) : 0,
              purchaseDate: new Date(purchaseDate).getTime(),
              purchaseMarketplace: marketplace || null,
              notes,
            }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) throw new Error(data.error ?? "Kunne ikke gemme");
          setProductLabel("");
          setPurchasePrice("");
          setExpenses("");
          setNotes("");
          setVisible(false);
          onClose?.();
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ukendt fejl");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink">💸 Ny flip-post</h2>
        <button type="button" onClick={() => setVisible(false)} className="text-[11.5px] text-dim hover:text-ink">
          Luk
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div>
          <Label htmlFor="fl-label">Produkt</Label>
          <Input id="fl-label" value={productLabel} onChange={(e) => setProductLabel(e.target.value)} placeholder="iPhone 16 Pro 256 GB" required />
        </div>
        <div>
          <Label htmlFor="fl-price">🪙 Købspris (kr)</Label>
          <Input id="fl-price" type="number" min={0} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="fl-exp">Omkostninger (kr)</Label>
          <Input id="fl-exp" type="number" min={0} value={expenses} onChange={(e) => setExpenses(e.target.value)} placeholder="fragt, reservedel …" />
        </div>
        <div>
          <Label htmlFor="fl-date">Købsdato</Label>
          <Input id="fl-date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="fl-mp">🛒 Kilde</Label>
          <Select id="fl-mp" value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
            <option value="">Ukendt</option>
            {["dba", "facebook", "vinted", "manual", "email", "demo"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-3">
        <Label htmlFor="fl-notes">Noter</Label>
        <Textarea id="fl-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Stand, tilbud, forbehold …" />
      </div>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      <div className="mt-3">
        <Button type="submit" size="sm" variant="primary" disabled={busy}>
          {busy ? "Gemmer…" : "Gem"}
        </Button>
      </div>
    </form>
  );
}

export function FlipRowActions({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = React.useState(false);
  const [salePrice, setSalePrice] = React.useState("");
  const [salePlatform, setSalePlatform] = React.useState("");
  const [offer, setOffer] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  async function call(payload: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/flips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        <select
          value={status}
          disabled={busy}
          onChange={(e) => call({ action: "update", status: e.target.value })}
          className="h-7 rounded-md border border-line bg-panel-2 px-1.5 text-[11.5px] text-ink outline-none"
        >
          {FLIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          className="rounded border border-line px-1.5 py-1 text-[10.5px] text-muted transition-colors hover:text-ink"
        >
          💸 Sælg
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => call({ action: "delete" })}
          className="rounded p-1 text-dim transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {open && (
        <div className="w-56 rounded-md border border-line bg-panel-2 p-2">
          <Label htmlFor={`offer-${id}`}>🤝 Tilbud (kr)</Label>
          <Input id={`offer-${id}`} type="number" value={offer} onChange={(e) => setOffer(e.target.value)} className="mb-2 h-7" />
          <Label htmlFor={`sp-${id}`}>💸 Salgspris (kr)</Label>
          <Input id={`sp-${id}`} type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="mb-2 h-7" />
          <Label htmlFor={`plat-${id}`}>🏷 Salgsplatform</Label>
          <Input id={`plat-${id}`} value={salePlatform} onChange={(e) => setSalePlatform(e.target.value)} className="mb-2 h-7" placeholder="vinted, dba …" />
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => call({ action: "update", offerDkk: offer ? Number(offer) : null, status: "NEGOTIATING" })}
            >
              Gem tilbud
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={busy || !salePrice}
              onClick={() =>
                call({
                  action: "close",
                  salePriceDkk: Number(salePrice),
                  saleDate: Date.now(),
                  salePlatform: salePlatform || null,
                  status: "SOLD" as FlipStatus,
                })
              }
            >
              Solgt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
