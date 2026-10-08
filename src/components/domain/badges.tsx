import type { DataOrigin, DealTier, RiskLevel } from "@/lib/core/types";
import { TIER_META } from "@/lib/core/deal-score";
import { RISK_META } from "@/lib/core/risk-score";
import { VELOCITY_META, type VelocityLevel } from "@/lib/core/velocity";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/**
 * Semantic colour language (per product spec):
 *   🟢 green  = financially / operationally positive
 *   🔵 blue   = information, market data, neutral state
 *   🟡 yellow = inspect before acting
 *   🟠 orange = unusually attractive
 *   🔴 red    = urgency (🔥/🚨) OR risk (🚩/⛔) - never mixed without the icon
 *   🟣 purple = machine-derived (AI parsing, smart matches)
 *   ⚪/⚫ grey = unknown, historical, inactive
 */
const TONE_CLASS: Record<string, string> = {
  // opportunity
  normal: "border-info/35 bg-info/10 text-info",
  good: "border-good/35 bg-good/10 text-good",
  great: "border-accent/40 bg-accent/12 text-accent",
  hot: "border-accent/50 bg-accent/15 text-accent-2",
  urgent: "border-steal/50 bg-steal/15 text-steal",
  // risk
  low: "border-good/30 bg-good/10 text-good",
  check: "border-warn/35 bg-warn/10 text-warn",
  elevated: "border-accent/40 bg-accent/12 text-accent",
  high: "border-danger/40 bg-danger/12 text-danger",
  avoid: "border-danger/60 bg-danger/20 text-danger",
  // misc
  info: "border-info/35 bg-info/10 text-info",
  warn: "border-warn/35 bg-warn/10 text-warn",
  danger: "border-danger/40 bg-danger/12 text-danger",
  dim: "border-line bg-panel-2 text-dim",
  ai: "border-demo/40 bg-demo/12 text-demo",
  live: "border-live/40 bg-live/12 text-live",
  connected: "border-info/35 bg-info/10 text-info",
  limited: "border-warn/35 bg-warn/10 text-warn",
  manual: "border-line-2 bg-panel-2 text-muted",
  unavailable: "border-line bg-panel-2 text-dim",
};

export function toneClass(tone: string) {
  return TONE_CLASS[tone] ?? TONE_CLASS.dim;
}

function Pill({ tone, className, children, title }: { tone: string; className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium leading-none",
        toneClass(tone),
        className
      )}
    >
      {children}
    </span>
  );
}

/** 📥 Datakilde: 🟢 REAL · 🔵 IMPORTED · 🟣 AI ENRICHED · 🟡 STALE · ⚪ DEMO */
const ORIGIN_META: Record<string, { emoji: string; label: string; tone: string; help: string }> = {
  REAL: {
    emoji: "🟢",
    label: "REAL",
    tone: "live",
    help: "Hentet fra en godkendt datakilde eller en konfigureret integration",
  },
  IMPORTED: {
    emoji: "🔵",
    label: "IMPORTED",
    tone: "info",
    help: "Importeret af dig: URL, tekst, CSV, JSON eller e-mail-alert",
  },
  AI_ENRICHED: {
    emoji: "🟣",
    label: "AI",
    tone: "ai",
    help: "Produktfelter er udledt automatisk - bekræft specifikationerne",
  },
  STALE: {
    emoji: "🟡",
    label: "STALE",
    tone: "warn",
    help: "Data er ældre end friskhedsvinduet i Settings",
  },
  DEMO: {
    emoji: "⚪",
    label: "DEMO",
    tone: "unavailable",
    help: "Kunstig udviklingsfixture - ikke en rigtig markedsplads-annonce",
  },
};

export function OriginBadge({ origin, className }: { origin: DataOrigin | string; className?: string }) {
  const meta = ORIGIN_META[origin] ?? ORIGIN_META.DEMO;
  return (
    <Pill tone={meta.tone} className={className} title={meta.help}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </Pill>
  );
}

/** 🎯 Opportunity priority: 🔵 NORMAL · 🟢 GOOD · 🟠 GREAT · 🔥 HOT · 🚨 URGENT STEAL */
export function TierBadge({ tier, className }: { tier: string; className?: string }) {
  const meta = TIER_META[(tier as DealTier) ?? "NORMAL"] ?? TIER_META.NORMAL;
  return (
    <Pill tone={meta.tone} className={className} title={`Opportunity priority: ${meta.label}`}>
      {meta.label}
    </Pill>
  );
}

export function tierTone(tier: string) {
  return (TIER_META[(tier as DealTier) ?? "NORMAL"] ?? TIER_META.NORMAL).tone;
}

/** 🛡 Risk: 🟢 LOW · 🟡 CHECK · 🟠 ELEVATED · 🔴 HIGH · ⛔ AVOID */
export function RiskBadge({ level, score, className }: { level: string; score?: number; className?: string }) {
  const meta = RISK_META[(level as RiskLevel) ?? "LOW"] ?? RISK_META.LOW;
  return (
    <Pill
      tone={meta.tone}
      className={className}
      title={`🛡 Risikoscore ${score ?? "?"}/100 - uafhængig af DealScore`}
    >
      {meta.label}
      {score !== undefined && <span className="mono opacity-70">{score}</span>}
    </Pill>
  );
}

/** 🔌 Provider state: 🟢 LIVE · 🔵 CONNECTED · 🟡 LIMITED · 📥 MANUAL IMPORT · ⚪ UNAVAILABLE */
const PROVIDER_META: Record<string, { emoji: string; label: string; tone: string }> = {
  LIVE: { emoji: "🟢", label: "LIVE", tone: "live" },
  CONNECTED: { emoji: "🔵", label: "CONNECTED", tone: "connected" },
  LIMITED: { emoji: "🟡", label: "LIMITED", tone: "limited" },
  MANUAL: { emoji: "📥", label: "MANUEL IMPORT", tone: "manual" },
  MANUAL_IMPORT: { emoji: "📥", label: "MANUEL IMPORT", tone: "manual" },
  UNAVAILABLE: { emoji: "⚪", label: "UNAVAILABLE", tone: "unavailable" },
};

export function ProviderBadge({ provider, className }: { provider: string; className?: string }) {
  const meta = PROVIDER_META[provider] ?? PROVIDER_META.UNAVAILABLE;
  return (
    <Pill tone={meta.tone} className={className}>
      {meta.emoji} {meta.label}
    </Pill>
  );
}

export function providerTone(status: string) {
  return (PROVIDER_META[status] ?? PROVIDER_META.UNAVAILABLE).tone;
}

/** 💨 Deal velocity estimate. Always labelled as an estimate. */
export function VelocityBadge({ level, className }: { level: string; className?: string }) {
  const meta = VELOCITY_META[(level as VelocityLevel) ?? "NORMAL"] ?? VELOCITY_META.NORMAL;
  return (
    <Pill tone={meta.tone} className={className} title="💨 Estiméret hastighed - hvor hurtigt annoncen sandsynligvis forsvinder">
      {meta.emoji} {meta.label}
    </Pill>
  );
}

export function JustListedBadge({ ageMin }: { ageMin: number }) {
  if (ageMin > 45) return null;
  return (
    <Pill tone="hot" title="⚡ Ny eller nyopdateret annonce">
      {ageMin <= 10 ? "⚡" : "🆕"} {Math.max(1, Math.round(ageMin))}m
    </Pill>
  );
}

export function ConfidenceBadge({ confidence, sample }: { confidence: string; sample: number }) {
  const tone =
    confidence === "HIGH" ? "good" : confidence === "MEDIUM" ? "warn" : confidence === "LOW" ? "elevated" : "dim";
  const emoji = confidence === "HIGH" ? "✅" : confidence === "MEDIUM" ? "👀" : confidence === "LOW" ? "⚠️" : "⚪";
  return (
    <Pill tone={tone} title={`${sample} prisobservationer bag estimatet`}>
      {emoji} {sample} obs · {confidence}
    </Pill>
  );
}

export function AiParsedBadge({ className }: { className?: string }) {
  return (
    <Pill tone="ai" className={className} title="🟣 Produktfelter udledt automatisk af parseren">
      🟣 AI PARSED
    </Pill>
  );
}

export function HiddenGemBadge({ className }: { className?: string }) {
  return (
    <Pill tone="ai" className={className} title="💎 Vagt annonce med stærkt udledt specifikation">
      💎 HIDDEN GEM
    </Pill>
  );
}

export { TIER_META, RISK_META, VELOCITY_META, Badge };
