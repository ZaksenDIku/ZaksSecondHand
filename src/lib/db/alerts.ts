import { db } from "./index";
import { alertRules, alerts, listings, watchRules } from "./schema";
import {eq} from "drizzle-orm";
import type { AnalysisResult } from "./ingest";
import { newId } from "./ids";
import { dispatchNotifications } from "../notifications";
import { formatDkk } from "../core/format";

export interface AlertRuleInput {
  name: string;
  kind: "deal_score" | "profit" | "discount" | "price_below";
  threshold: number;
  canonicalKey?: string | null;
  productType?: string | null;
  enabled?: boolean;
  cooldownMinutes?: number;
}

export function createAlertRule(input: AlertRuleInput): string {
  const id = newId("rule");
  db.insert(alertRules)
    .values({
      id,
      name: input.name,
      kind: input.kind,
      threshold: input.threshold,
      canonicalKey: input.canonicalKey ?? null,
      productType: input.productType ?? null,
      enabled: input.enabled ?? true,
      cooldownMinutes: input.cooldownMinutes ?? 60,
      createdAt: Date.now(),
    })
    .run();
  return id;
}

export function seedDefaultAlertRules() {
  const existing = db.select().from(alertRules).all();
  if (existing.length > 0) return;
  createAlertRule({ name: "Deal score >= 85", kind: "deal_score", threshold: 85 });
  createAlertRule({ name: "Nettoprofit >= 1.000 kr.", kind: "profit", threshold: 1000 });
  createAlertRule({ name: "20% under markedet", kind: "discount", threshold: 20 });
}

function matchesRule(
  rule: { kind: string; threshold: number; canonicalKey: string | null; productType: string | null },
  row: { dealScore: number; netProfitDkk: number | null; discountPct: number | null; priceDkk: number; canonicalKey: string | null; productType: string | null }
): boolean {
  if (rule.canonicalKey && row.canonicalKey !== rule.canonicalKey) return false;
  if (rule.productType && row.productType !== rule.productType) return false;
  switch (rule.kind) {
    case "deal_score":
      return row.dealScore >= rule.threshold;
    case "profit":
      return (row.netProfitDkk ?? 0) >= rule.threshold;
    case "discount":
      return (row.discountPct ?? 0) >= rule.threshold;
    case "price_below":
      return row.priceDkk > 0 && row.priceDkk <= rule.threshold;
    default:
      return false;
  }
}

function matchesWatchRule(
  rule: { canonicalKey: string | null; storageGb: number | null; maxPriceDkk: number | null; minDealScore: number | null; minProfitDkk: number | null; productType: string | null; enabled: boolean },
  row: { canonicalKey: string | null; storageGb: number | null; priceDkk: number; dealScore: number; netProfitDkk: number | null; productType: string | null }
): boolean {
  if (!rule.enabled) return false;
  if (rule.canonicalKey && row.canonicalKey !== rule.canonicalKey) return false;
  if (rule.productType && row.productType !== rule.productType) return false;
  if (rule.storageGb && row.storageGb !== rule.storageGb) return false;
  if (rule.maxPriceDkk && row.priceDkk > rule.maxPriceDkk) return false;
  if (rule.minDealScore && row.dealScore < rule.minDealScore) return false;
  if (rule.minProfitDkk && (row.netProfitDkk ?? 0) < rule.minProfitDkk) return false;
  return true;
}

export async function evaluateAlerts(
  listingId: string,
  analysis: AnalysisResult,
  now = Date.now()
): Promise<number> {
  const row = db.select().from(listings).where(eq(listings.id, listingId)).get();
  if (!row || row.ignored) return 0;
  if (row.origin === "DEMO") return 0;

  let fired = 0;

  const rules = db.select().from(alertRules).where(eq(alertRules.enabled, true)).all();
  for (const rule of rules) {
    if (rule.lastFiredAt && now - rule.lastFiredAt < rule.cooldownMinutes * 60000) continue;
    if (!matchesRule(rule, row)) continue;
    db.update(alertRules).set({ lastFiredAt: now }).where(eq(alertRules.id, rule.id)).run();
    fired += await recordAlert({
      ruleId: rule.id,
      ruleName: rule.name,
      listingId,
      title: `${row.title} · ${formatDkk(row.priceDkk)}`,
      body: [
        `${rule.name}`,
        `Pris: ${formatDkk(row.priceDkk)}`,
        analysis.marketValue ? `Marked: ${formatDkk(analysis.marketValue)}` : null,
        analysis.netProfit ? `Forventet netto: ${formatDkk(analysis.netProfit)}` : null,
        `Deal score: ${analysis.dealScore}/100`,
        row.url ? row.url : "Manuelt importeret (ingen URL)",
      ]
        .filter(Boolean)
        .join("\n"),
      severity: analysis.dealScore >= 85 ? "critical" : "info",
      category: analysis.dealTier === "URGENT" ? "URGENT" : analysis.dealScore >= 85 ? "HOT" : "INFO",
      origin: row.origin,
    });
  }

  // 📉 PRICE DROP — the listing itself is not new, but it just got cheaper.
  if (row.priceChangedFrom && row.priceChangedFrom > row.priceDkk) {
    const drop = row.priceChangedFrom - row.priceDkk;
    fired += await recordAlert({
      ruleId: null,
      ruleName: "Pris faldet",
      listingId,
      title: `📉 Prisfald: ${row.title} · −${formatDkk(drop)}`,
      body: [`Før: ${formatDkk(row.priceChangedFrom)}`, `Nu: ${formatDkk(row.priceDkk)}`, `Fald: ${formatDkk(drop)}`].join("\n"),
      severity: "info",
      category: "PRICE_DROP",
      origin: row.origin,
      dedupFacts: `${row.priceChangedFrom}->${row.priceDkk}`,
    });
  }

  // 💎 HIDDEN GEM — a sloppy listing that is nonetheless clearly underpriced.
  if (row.hiddenGemScore >= 45 && (row.discountPct ?? 0) >= 10) {
    fired += await recordAlert({
      ruleId: null,
      ruleName: "Hidden gem",
      listingId,
      title: `💎 Hidden gem: ${row.title} · ${formatDkk(row.priceDkk)}`,
      body: [
        `Oprindelig titel: "${row.rawTitle}"`,
        `Registreret som: ${row.title}`,
        `Hidden-gem-score: ${row.hiddenGemScore}`,
        `${Math.round(row.discountPct ?? 0)} % under estimeret markedspris`,
      ].join("\n"),
      severity: "info",
      category: "HIDDEN_GEM",
      origin: row.origin,
      dedupFacts: `gem${row.hiddenGemScore}@${row.priceDkk}`,
    });
  }

  // 🛡 RISK CHANGE — a blocking or serious signal was found.
  const blocking = row.riskLevel === "AVOID" || row.riskLevel === "HIGH";
  if (blocking) {
    fired += await recordAlert({
      ruleId: null,
      ruleName: "Risiko ændret",
      listingId,
      title: `🛡 Risikofaktor: ${row.title} (${row.riskLevel})`,
      body: `Risikoscore ${row.riskScore}/100. Gennemgå altid checklisten før køb - en billig enhed med høj risiko er ikke automatisk et godt køb.`,
      severity: "critical",
      category: "RISK_CHANGE",
      origin: row.origin,
      dedupFacts: `${row.riskLevel}@${row.riskScore}`,
    });
  }

  const watches = db.select().from(watchRules).where(eq(watchRules.enabled, true)).all();
  for (const rule of watches) {
    if (!matchesWatchRule(rule, row)) continue;
    db.update(watchRules).set({ lastMatchAt: now }).where(eq(watchRules.id, rule.id)).run();
    fired += await recordAlert({
      ruleId: rule.id,
      ruleName: `Watchlist: ${rule.label}`,
      listingId,
      title: `Watchlist-træffere: ${row.title} · ${formatDkk(row.priceDkk)}`,
      body: [
        `${rule.label}`,
        `Pris: ${formatDkk(row.priceDkk)}${
          rule.maxPriceDkk ? ` (mål: ${formatDkk(rule.maxPriceDkk)})` : ""
        }`,
        `Deal score: ${analysis.dealScore}/100`,
      ].join("\n"),
      severity: "watch",
      category: "TARGET_HIT",
      origin: row.origin,
      // A watch hit is only news when the price or score actually moved.
      dedupFacts: `${row.priceDkk}@${analysis.dealScore}`,
    });
  }

  return fired;
}

/**
 * Alerts that describe a standing condition (a risk signal, a hidden gem, the
 * fact that a listing is simply cheap) would otherwise re-fire on every
 * re-analysis. A stable fingerprint lets us tell "still true" from "changed",
 * so a repeat is suppressed and only a new price, score or risk level alerts
 * again.
 */
function fingerprint(input: { category?: string; ruleId: string | null; listingId: string }, facts: string): string {
  return [input.category ?? "INFO", input.ruleId ?? "", input.listingId, facts].join("|");
}

const DEFAULT_DEDUP_WINDOW_MS = 6 * 3600_000;

async function recordAlert(input: {
  ruleId: string | null;
  ruleName: string;
  listingId: string;
  title: string;
  body: string;
  severity: string;
  category?: string;
  origin: string;
  /** Values that must change before this alert is considered new again. */
  dedupFacts?: string;
  dedupWindowMs?: number;
}): Promise<number> {
  let dedupKey: string | null = null;
  if (input.dedupFacts !== undefined) {
    dedupKey = fingerprint(input, input.dedupFacts);
    const window = input.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS;
    const previous = db
      .select({ createdAt: alerts.createdAt })
      .from(alerts)
      .where(eq(alerts.dedupKey, dedupKey))
      .get();
    if (previous && Date.now() - previous.createdAt < window) return 0;
  }

  const id = newId("alrt");
  db.insert(alerts)
    .values({
      id,
      ruleId: input.ruleId,
      ruleName: input.ruleName,
      listingId: input.listingId,
      title: input.title,
      body: input.body,
      severity: input.severity,
      category: input.category ?? "INFO",
      origin: input.origin,
      createdAt: Date.now(),
      deliveries: JSON.stringify([]),
      dedupKey,
    })
    .run();
  await dispatchNotifications({ title: input.title, body: input.body });
  return 1;
}
