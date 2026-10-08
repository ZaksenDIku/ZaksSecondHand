"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Rocket, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

interface SetupFormProps {
  defaults: {
    maxBudgetDkk: number;
    minProfitDkk: number;
    minRoiPct: number;
    location: string;
    maxTravelRadiusKm: number;
    products: string[];
    preferredMarketplaces: string[];
  };
}

export function SetupForm({ defaults }: SetupFormProps) {
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [demo, setDemo] = React.useState(true);
  const [p, setP] = React.useState({
    maxBudgetDkk: defaults.maxBudgetDkk,
    minProfitDkk: defaults.minProfitDkk,
    minRoiPct: defaults.minRoiPct,
    location: defaults.location,
    maxTravelRadiusKm: defaults.maxTravelRadiusKm,
    products: defaults.products,
    preferredMarketplaces: defaults.preferredMarketplaces,
  });
  const router = useRouter();

  async function finish(withDemo: boolean) {
    setBusy(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: p, demo: { enabled: withDemo }, setupComplete: true }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  const steps = ["Velkommen", "Købsprofil", "Datakilder"];

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                i < step ? "bg-good/20 text-good" : i === step ? "bg-accent text-black" : "bg-panel-2 text-dim"
              }`}
            >
              {i < step ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-[11.5px] ${i === step ? "text-ink" : "text-dim"}`}>{s}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="panel p-6">
          <div className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            <Rocket size={18} className="text-accent" /> Velkommen til ZaksSecondHand
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
            Appen vurderer iPhone 15+ og MacBook M1+ på dansk videresalgsmarked. Den læser kun data fra kilder, du
            selv tilføjer — ingen automatisk scraping af markedspladser, der forbyder det.
          </p>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-muted">
            <li>🟢 REAL · 🔵 IMPORTED · ⚪ DEMO · 🟣 AI PARSED — data er altid mærket</li>
            <li>🎯 DealScore, 🛡 RiskScore, 💨 hastighed og 💸 ROI beregnes lokalt</li>
            <li>🔐 Alt gemmes i en lokal SQLite-fil. Ingen data forlader din computer.</li>
          </ul>
          <div className="mt-5 flex justify-end">
            <Button variant="primary" onClick={() => setStep(1)}>
              Kom i gang →
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="panel p-6">
          <h2 className="text-[15px] font-semibold text-ink">🎯 Din købsprofil</h2>
          <p className="mt-1 text-[12px] text-dim">
            Brugt til at sortere fund og til at beregne din makspris. Du kan altid ændre det under ⚙️ Settings.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="st-budget">💰 Maks købsbudget (kr)</Label>
              <Input id="st-budget" type="number" value={p.maxBudgetDkk} onChange={(e) => setP({ ...p, maxBudgetDkk: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="st-minprofit">💸 Min. ønsket profit (kr)</Label>
              <Input id="st-minprofit" type="number" value={p.minProfitDkk} onChange={(e) => setP({ ...p, minProfitDkk: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="st-roi">📈 Min. ROI (%)</Label>
              <Input id="st-roi" type="number" step="0.5" value={p.minRoiPct} onChange={(e) => setP({ ...p, minRoiPct: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="st-radius">🚗 Maks kørselsafstand (km)</Label>
              <Input id="st-radius" type="number" value={p.maxTravelRadiusKm} onChange={(e) => setP({ ...p, maxTravelRadiusKm: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="st-loc">📍 Område</Label>
              <Input id="st-loc" value={p.location} onChange={(e) => setP({ ...p, location: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="st-products">📱💻 Produkter</Label>
              <Select
                id="st-products"
                value={p.products.join(",")}
                onChange={(e) => setP({ ...p, products: e.target.value.split(",").filter(Boolean) })}
              >
                <option value="iphone,macbook">📱 iPhone + 💻 MacBook</option>
                <option value="iphone">📱 Kun iPhone</option>
                <option value="macbook">💻 Kun MacBook</option>
              </Select>
            </div>
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              ← Tilbage
            </Button>
            <Button variant="primary" onClick={() => setStep(2)}>
              Næste →
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="panel p-6">
          <h2 className="text-[15px] font-semibold text-ink">🔌 Hvor kommer data fra?</h2>
          <p className="mt-1 text-[12px] text-dim">
            Vælg DEMO for at udforske appen med syntetiske data, eller start rent med din egen import.
          </p>
          <div className="mt-4 space-y-2.5">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                demo ? "border-accent/60 bg-accent/8" : "border-line bg-panel"
              }`}
            >
              <input type="radio" checked={demo} onChange={() => setDemo(true)} className="mt-1" />
              <span>
                <span className="block text-[13px] text-ink">⚪ Start med DEMO-data</span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  ~60 syntetiske, tydeligt mærkede fund så du kan se hele systemet virke. Kan slås fra når som helst.
                </span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                !demo ? "border-accent/60 bg-accent/8" : "border-line bg-panel"
              }`}
            >
              <input type="radio" checked={!demo} onChange={() => setDemo(false)} className="mt-1" />
              <span>
                <span className="block text-[13px] text-ink">🔵 Start rent</span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  Ingen data indtil du importerer. Estimaterne bygger kun på dine egne importerede annoncer.
                </span>
              </span>
            </label>
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Tilbage
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => finish(demo)}>
              {busy ? "Opsætter…" : "🚀 Åbn 🔥 Deal Center"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
