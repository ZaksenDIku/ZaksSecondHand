"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {Input, Label, Select} from "@/components/ui/input";

interface SettingsPayload {
  freshnessHours: number;
  demo: { enabled: boolean };
  weights: Record<string, number>;
  flip: { platformFeePct: number; transportDkk: number; repairAllowanceDkk: number };
  profile: {
    maxBudgetDkk: number;
    minProfitDkk: number;
    minRoiPct: number;
    location: string;
    maxTravelRadiusKm: number;
    preferredMarketplaces: string[];
    products: string[];
    notifications: string[];
  };
  notifications: {
    browser: boolean;
    telegram: { enabled: boolean; botToken: string; chatId: string };
    discord: { enabled: boolean; webhookUrl: string };
    email: { enabled: boolean; resendApiKey: string; to: string; from: string };
  };
}

const WEIGHT_LABELS: Record<string, { label: string; hint: string }> = {
  discountWeight: { label: "💰 Rabat vægt", hint: "Hvor meget afvigelse fra markedsværdien betyder" },
  profitWeight: { label: "💸 Profit vægt", hint: "Absolut fortjeneste i kroner" },
  roiWeight: { label: "📈 ROI vægt", hint: "Procentuel afkastning" },
  freshnessWeight: { label: "⚡ Friskhed vægt", hint: "Nye og hurtigt faldende annoncer" },
  confidenceWeight: { label: "📊 Tillid vægt", hint: "Hvor sikkert markedsestimatet er" },
  riskPenalty: { label: "🛡 Risikostraf", hint: "Fratrækkes fra scoren uafhængigt af pris" },
};

export function SettingsForm({ initial }: { initial: SettingsPayload }) {
  const [s, setS] = React.useState<SettingsPayload>(initial);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = React.useState(false);
  const router = useRouter();

  async function save(reanalyze = false) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          freshnessHours: s.freshnessHours,
          demo: s.demo,
          weights: s.weights,
          flip: s.flip,
          profile: s.profile,
          notifications: s.notifications,
          reanalyze,
        }),
      });
      const data = (await res.json()) as { error?: string; reanalyzed?: number };
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke gemme");
      setMsg(
        reanalyze
          ? `✅ Gemt — ${data.reanalyzed ?? 0} annoncer genberegnet`
          : "✅ Indstillinger gemt"
      );
      router.refresh();
    } catch (err) {
      setMsg(`⛔ ${err instanceof Error ? err.message : "Ukendt fejl"}`);
    } finally {
      setBusy(false);
    }
  }

  async function demoAction(action: "seed" | "clear") {
    setReanalyzing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ demoAction: action, reanalyze: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke ændre DEMO-data");
      setMsg(action === "seed" ? "✅ DEMO-data regenereret" : "✅ DEMO-data fjernet");
      router.refresh();
    } catch (err) {
      setMsg(`⛔ ${err instanceof Error ? err.message : "Ukendt fejl"}`);
    } finally {
      setReanalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <h2 className="text-[13px] font-semibold text-ink">💰 Dit købsprofil</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div>
            <Label htmlFor="s-budget">Maks købsbudget (kr)</Label>
            <Input
              id="s-budget"
              type="number"
              value={s.profile.maxBudgetDkk}
              onChange={(e) => setS({ ...s, profile: { ...s.profile, maxBudgetDkk: Number(e.target.value) } })}
            />
          </div>
          <div>
            <Label htmlFor="s-profit">Min. ønsket profit (kr)</Label>
            <Input
              id="s-profit"
              type="number"
              value={s.profile.minProfitDkk}
              onChange={(e) => setS({ ...s, profile: { ...s.profile, minProfitDkk: Number(e.target.value) } })}
            />
          </div>
          <div>
            <Label htmlFor="s-roi">Min. ROI (%)</Label>
            <Input
              id="s-roi"
              type="number"
              step="0.5"
              value={s.profile.minRoiPct}
              onChange={(e) => setS({ ...s, profile: { ...s.profile, minRoiPct: Number(e.target.value) } })}
            />
          </div>
          <div>
            <Label htmlFor="s-fresh">Friskhedsvindue (timer)</Label>
            <Input
              id="s-fresh"
              type="number"
              value={s.freshnessHours}
              onChange={(e) => setS({ ...s, freshnessHours: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="s-loc">📍 Område</Label>
            <Input
              id="s-loc"
              value={s.profile.location}
              onChange={(e) => setS({ ...s, profile: { ...s.profile, location: e.target.value } })}
            />
          </div>
          <div>
            <Label htmlFor="s-radius">🚗 Maks kørselsafstand (km)</Label>
            <Input
              id="s-radius"
              type="number"
              value={s.profile.maxTravelRadiusKm}
              onChange={(e) => setS({ ...s, profile: { ...s.profile, maxTravelRadiusKm: Number(e.target.value) } })}
            />
          </div>
          <div>
            <Label htmlFor="s-products">📱💻 Produkter</Label>
            <Select
              id="s-products"
              value={s.profile.products.join(",")}
              onChange={(e) => setS({ ...s, profile: { ...s.profile, products: e.target.value.split(",").filter(Boolean) } })}
            >
              <option value="iphone,macbook">📱 iPhone + 💻 MacBook</option>
              <option value="iphone">📱 Kun iPhone</option>
              <option value="macbook">💻 Kun MacBook</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="s-mp">🛒 Foretrukne markedspladser</Label>
            <Select
              id="s-mp"
              value={s.profile.preferredMarketplaces.join(",")}
              onChange={(e) =>
                setS({ ...s, profile: { ...s.profile, preferredMarketplaces: e.target.value.split(",").filter(Boolean) } })
              }
            >
              <option value="dba,facebook,vinted,manual">DBA, Facebook, Vinted, manuel</option>
              <option value="dba,manual">DBA + manuel import</option>
              <option value="facebook,manual">Facebook + manuel import</option>
              <option value="vinted,manual">Vinted + manuel import</option>
            </Select>
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-[13px] font-semibold text-ink">🎯 DealScore-vægtning</h2>
        <p className="mt-1 text-[11.5px] text-dim">
          Vægterne styrer, hvad der gør en annonce til en god deal. Alle vægte er konfigurerbare — og risikostrafen
          trækkes altid fra uafhængigt af pris.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Object.entries(WEIGHT_LABELS).map(([key, meta]) => (
            <div key={key}>
              <Label htmlFor={`w-${key}`}>{meta.label}</Label>
              <Input
                id={`w-${key}`}
                type="number"
                step="1"
                value={s.weights[key] ?? 0}
                onChange={(e) => setS({ ...s, weights: { ...s.weights, [key]: Number(e.target.value) } })}
              />
              <p className="mt-0.5 text-[10.5px] text-dim">{meta.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-[13px] font-semibold text-ink">💸 Flip-omkostninger</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="f-fee">Platformgebyr (%)</Label>
            <Input
              id="f-fee"
              type="number"
              step="0.5"
              value={s.flip.platformFeePct}
              onChange={(e) => setS({ ...s, flip: { ...s.flip, platformFeePct: Number(e.target.value) } })}
            />
          </div>
          <div>
            <Label htmlFor="f-trans">🚚 Transport (kr)</Label>
            <Input
              id="f-trans"
              type="number"
              value={s.flip.transportDkk}
              onChange={(e) => setS({ ...s, flip: { ...s.flip, transportDkk: Number(e.target.value) } })}
            />
          </div>
          <div>
            <Label htmlFor="f-rep">🔧 Reparationsreserve (kr)</Label>
            <Input
              id="f-rep"
              type="number"
              value={s.flip.repairAllowanceDkk}
              onChange={(e) => setS({ ...s, flip: { ...s.flip, repairAllowanceDkk: Number(e.target.value) } })}
            />
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-[13px] font-semibold text-ink">🔔 Notifikationer</h2>
        <p className="mt-1 text-[11.5px] text-dim">
          Nøgler lagres lokalt i SQLite og returneres aldrig til frontend — felterne vises som maskerede, når de er
          gemt.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input
              type="checkbox"
              checked={s.notifications.browser}
              onChange={(e) => setS({ ...s, notifications: { ...s.notifications, browser: e.target.checked } })}
            />
            🔔 Browser-notifikationer
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input
              type="checkbox"
              checked={s.notifications.telegram.enabled}
              onChange={(e) =>
                setS({ ...s, notifications: { ...s.notifications, telegram: { ...s.notifications.telegram, enabled: e.target.checked } } })
              }
            />
            ✈️ Telegram
          </label>
          <div className="lg:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tg-token">Telegram bot token</Label>
              <Input
                id="tg-token"
                type="password"
                value={s.notifications.telegram.botToken}
                onChange={(e) =>
                  setS({ ...s, notifications: { ...s.notifications, telegram: { ...s.notifications.telegram, botToken: e.target.value } } })
                }
              />
            </div>
            <div>
              <Label htmlFor="tg-chat">Telegram chat-id</Label>
              <Input
                id="tg-chat"
                value={s.notifications.telegram.chatId}
                onChange={(e) =>
                  setS({ ...s, notifications: { ...s.notifications, telegram: { ...s.notifications.telegram, chatId: e.target.value } } })
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input
              type="checkbox"
              checked={s.notifications.discord.enabled}
              onChange={(e) =>
                setS({ ...s, notifications: { ...s.notifications, discord: { ...s.notifications.discord, enabled: e.target.checked } } })
              }
            />
            🎮 Discord webhook
          </label>
          <div>
            <Label htmlFor="dc-hook">Discord webhook-URL</Label>
            <Input
              id="dc-hook"
              type="password"
              value={s.notifications.discord.webhookUrl}
              onChange={(e) =>
                setS({ ...s, notifications: { ...s.notifications, discord: { ...s.notifications.discord, webhookUrl: e.target.value } } })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input
              type="checkbox"
              checked={s.notifications.email.enabled}
              onChange={(e) =>
                setS({ ...s, notifications: { ...s.notifications, email: { ...s.notifications.email, enabled: e.target.checked } } })
              }
            />
            ✉️ E-mail (Resend)
          </label>
          <div>
            <Label htmlFor="em-to">Modtager</Label>
            <Input
              id="em-to"
              value={s.notifications.email.to}
              onChange={(e) => setS({ ...s, notifications: { ...s.notifications, email: { ...s.notifications.email, to: e.target.value } } })}
            />
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="text-[13px] font-semibold text-ink">⚪ DEMO-data</h2>
        <p className="mt-1 text-[11.5px] text-dim">
          DEMO bruges kun til udvikling og er konstant mærket ⚪ DEMO. Slå det fra, når du vil arbejde med rigtige data.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input
              type="checkbox"
              checked={s.demo.enabled}
              onChange={(e) => setS({ ...s, demo: { enabled: e.target.checked } })}
            />
            DEMO slået til
          </label>
          <Button size="sm" variant="outline" disabled={busy || reanalyzing} onClick={() => demoAction("seed")}>
            Generer DEMO igen
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => demoAction("clear")}>
            Slet alle DEMO-data
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" disabled={busy} onClick={() => save(false)}>
          <Save size={13} /> {busy ? "Gemmer…" : "Gem"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => save(true)}>
          <RefreshCw size={13} /> Gem og genberegn alle scorer
        </Button>
        {msg && <span className="text-[12px] text-muted">{msg}</span>}
      </div>
    </div>
  );
}
