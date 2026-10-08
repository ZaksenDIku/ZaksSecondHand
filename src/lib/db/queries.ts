import {desc, eq, sql} from "drizzle-orm";
import { db } from "./index";
import {
  alertRules,
  alerts,
  flips,
  listings,
  listingSnapshots,
  marketEstimates,
  marketplaces,
  notificationLog,
  priceObservations,
  riskSignals,
  savedSearches,
  watchRules,
} from "./schema";
import { effectiveOrigin, getAppSettings } from "./settings";
import type { DataOrigin, ListingFilters, SortKey } from "../core/types";
export type {
  ListingView,
  DashboardKpis,
  HeatmapEntry,
  WatchRow,
  FlipView,
  AnalyticsSummary,
  ListingDetail,
} from "../view-types";
import type {
  ListingView,
  DashboardKpis,
  HeatmapEntry,
  WatchRow,
  FlipView,
  AnalyticsSummary,
  ListingDetail,
} from "../view-types";
import { ageMinutes, isJustListed } from "../core/format";
import { lookupModel } from "../core/catalog";
import { parseSpecKey } from "../core/market-value";


function withDerived(row: typeof listings.$inferSelect, signalCount: number): ListingView {
  const ageMin = ageMinutes(row.postedAt);
  return {
    ...row,
    origin: row.origin as DataOrigin,
    model: row.model ?? "",
    ageMin,
    justListed: isJustListed(row.postedAt),
    signalCount,
    priceDrop: row.priceChangedFrom ? row.priceChangedFrom - row.priceDkk : null,
    inScope: row.origin === "DEMO" ? true : Boolean(row.canonicalKey && !row.canonicalKey.includes("unknown")),
  };
}

function allSignalsByListing(): Map<string, number> {
  const rows = db
    .select({ listingId: riskSignals.listingId, n: sql<number>`count(*)` })
    .from(riskSignals)
    .groupBy(riskSignals.listingId)
    .all();
  return new Map(rows.map((r) => [r.listingId, Number(r.n)]));
}

export function getAllListings(): ListingView[] {
  const settings = getAppSettings();
  const rows = db.select().from(listings).all();
  const signals = allSignalsByListing();
  const filtered = settings.demo.enabled ? rows : rows.filter((r) => r.origin !== "DEMO");
  return filtered
    .map((r) => withDerived(r, signals.get(r.id) ?? 0))
    .map((v) => ({ ...v, origin: effectiveOrigin(v) }));
}

const SORTERS: Record<SortKey, (a: ListingView, b: ListingView) => number> = {
  newest: (a, b) => (b.postedAt ?? b.firstSeenAt) - (a.postedAt ?? a.firstSeenAt),
  score: (a, b) => b.dealScore - a.dealScore,
  profit: (a, b) => (b.netProfitDkk ?? -1e9) - (a.netProfitDkk ?? -1e9),
  discount: (a, b) => (b.discountPct ?? -1e9) - (a.discountPct ?? -1e9),
  price_asc: (a, b) => a.priceDkk - b.priceDkk,
  roi: (a, b) => (b.roiPct ?? -1e9) - (a.roiPct ?? -1e9),
};

export function queryListings(filters: ListingFilters = {}): ListingView[] {
  let rows = getAllListings();

  if (!filters.includeIgnored) rows = rows.filter((r) => !r.ignored);
  if (!filters.includeDuplicates) rows = rows.filter((r) => !r.duplicateOf);
  rows = rows.filter((r) => r.status !== "archived");

  if (filters.marketplaces?.length) rows = rows.filter((r) => filters.marketplaces!.includes(r.marketplaceKey));
  if (filters.productTypes?.length)
    rows = rows.filter((r) => r.productType && filters.productTypes!.includes(r.productType));
  if (filters.productType) rows = rows.filter((r) => r.productType === filters.productType);
  if (filters.generations?.length)
    rows = rows.filter((r) => r.generation && filters.generations!.includes(r.generation));
  if (filters.models?.length) rows = rows.filter((r) => r.canonicalKey && filters.models!.includes(r.canonicalKey));
  if (filters.storageGb?.length) rows = rows.filter((r) => r.storageGb !== null && filters.storageGb!.includes(r.storageGb));
  if (filters.ramGb?.length) rows = rows.filter((r) => r.ramGb !== null && filters.ramGb!.includes(r.ramGb));
  if (filters.chips?.length) rows = rows.filter((r) => r.chip && filters.chips!.includes(r.chip));
  if (filters.minPrice !== undefined) rows = rows.filter((r) => r.priceDkk >= filters.minPrice!);
  if (filters.maxPrice !== undefined) rows = rows.filter((r) => r.priceDkk <= filters.maxPrice!);
  if (filters.minDealScore !== undefined) rows = rows.filter((r) => r.dealScore >= filters.minDealScore!);
  if (filters.minProfit !== undefined) rows = rows.filter((r) => (r.netProfitDkk ?? 0) >= filters.minProfit!);
  if (filters.minRoi !== undefined) rows = rows.filter((r) => (r.roiPct ?? 0) >= filters.minRoi!);
  if (filters.maxAgeMinutes !== undefined) rows = rows.filter((r) => r.ageMin <= filters.maxAgeMinutes!);
  if (filters.conditions?.length) rows = rows.filter((r) => r.condition && filters.conditions!.includes(r.condition));
  if (filters.minBattery !== undefined)
    rows = rows.filter((r) => r.batteryHealth !== null && r.batteryHealth >= filters.minBattery!);
  if (filters.riskLevels?.length) rows = rows.filter((r) => filters.riskLevels!.includes(r.riskLevel));
  if (filters.origins?.length) rows = rows.filter((r) => filters.origins!.includes(r.origin));
  if (filters.tiers?.length) rows = rows.filter((r) => filters.tiers!.includes(r.dealTier));
  if (filters.statuses?.length) rows = rows.filter((r) => filters.statuses!.includes(r.status));

  if (filters.q) {
    const q = filters.q.toLowerCase().trim();
    rows = rows.filter((r) =>
      [r.title, r.rawTitle, r.description, r.model, r.location, r.chip]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }

  const sort = filters.sort ?? "score";
  rows.sort(SORTERS[sort] ?? SORTERS.score);

  if (filters.limit) rows = rows.slice(0, filters.limit);
  return rows;
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------


export function getDashboardKpis(): DashboardKpis {
  const all = getAllListings().filter((r) => !r.ignored);
  const primary = all.filter((r) => !r.duplicateOf);
  const fresh = primary.filter((r) => r.origin !== "DEMO" || getAppSettings().demo.enabled);
  const active = fresh.filter((r) => r.status === "active");

  const hot = active.filter((r) => r.dealTier === "STEAL" || r.dealScore >= 85);
  const lastHour = active.filter((r) => r.ageMin <= 60);
  const profitRows = [...active]
    .filter((r) => (r.netProfitDkk ?? 0) > 0 && r.dealScore >= 55)
    .sort((a, b) => b.dealScore - a.dealScore)
    .slice(0, 20);
  const availableProfit = profitRows.reduce((sum, r) => sum + (r.netProfitDkk ?? 0), 0);

  const ages = active.map((r) => r.ageMin).sort((a, b) => a - b);
  const medianAgeMin = ages.length ? ages[Math.floor(ages.length / 2)] : 0;
  const avgScore = active.length
    ? Math.round(active.reduce((s, r) => s + r.dealScore, 0) / active.length)
    : 0;

  return {
    hotDeals: hot.length,
    lastHour: lastHour.length,
    availableProfit,
    iphoneOpps: active.filter((r) => r.productType === "iphone" && r.dealScore >= 60).length,
    macbookOpps: active.filter((r) => r.productType === "macbook" && r.dealScore >= 60).length,
    medianAgeMin,
    avgScore,
    totalActive: active.length,
    duplicatesHidden: all.filter((r) => r.duplicateOf).length,
    demoActive: getAppSettings().demo.enabled,
    realCount: all.filter((r) => r.origin === "REAL").length,
    importedCount: all.filter((r) => r.origin === "IMPORTED").length,
    demoCount: all.filter((r) => r.origin === "DEMO").length,
    staleCount: all.filter((r) => r.origin === "STALE").length,
  };
}

// ---------------------------------------------------------------------------
// Market heatmap
// ---------------------------------------------------------------------------


export function specLabel(specKey: string): { label: string; storageGb: number | null } {
  const parts = parseSpecKey(specKey);
  const def = lookupModel(parts.canonicalKey);
  const base = def?.label ?? parts.canonicalKey.replace(/[:|-]/g, " ");
  if (parts.canonicalKey.startsWith("macbook")) {
    const bits = [base];
    if (parts.screen) bits.push(parts.screen.replace("-inch", '"'));
    if (parts.ramGb) bits.push(`${parts.ramGb}/${parts.storageGb ?? "?"}`);
    else if (parts.storageGb) bits.push(`${parts.storageGb}GB`);
    return { label: bits.join(" "), storageGb: parts.storageGb };
  }
  const storage = parts.storageGb ? `${parts.storageGb} GB` : "";
  return { label: [base, storage].filter(Boolean).join(" "), storageGb: parts.storageGb };
}

export function getHeatmap(productType?: string): HeatmapEntry[] {
  const settings = getAppSettings();
  const estimates = db.select().from(marketEstimates).all();
  const cheapest = new Map<string, number>();
  for (const l of getAllListings()) {
    if (!l.specKey) continue;
    if (l.status !== "active") continue;
    const current = cheapest.get(l.specKey);
    if (current === undefined || l.priceDkk < current) cheapest.set(l.specKey, l.priceDkk);
  }

  return estimates
    .filter((e) => !(!settings.demo.enabled && e.specKey.includes("demo")))
    .map((e) => {
      const { label, storageGb } = specLabel(e.specKey);
      const type = e.canonicalKey.startsWith("iphone")
        ? "iphone"
        : e.canonicalKey.startsWith("macbook")
          ? "macbook"
          : null;
      return {
        specKey: e.specKey,
        canonicalKey: e.canonicalKey,
        label,
        storageGb,
        sampleCount: e.sampleCount,
        median: e.medianDkk,
        buyBelow: e.medianDkk ? Math.round(e.medianDkk * 0.88) : null,
        stealBelow: e.medianDkk ? Math.round(e.medianDkk * 0.75) : null,
        p25: e.p25Dkk,
        p75: e.p75Dkk,
        trend30Pct: e.trend30Pct,
        trend7Pct: e.trend7Pct,
        confidence: e.confidence,
        productType: type,
        cheapest: cheapest.get(e.specKey) ?? null,
      };
    })
    .filter((e) => !productType || e.productType === productType)
    .sort((a, b) => b.sampleCount - a.sampleCount);
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------


export function getWatchlist(): WatchRow[] {
  const rules = db.select().from(watchRules).all();
  const all = getAllListings().filter((r) => !r.ignored && !r.duplicateOf && r.status === "active");
  const estimates = db.select().from(marketEstimates).all();

  return rules.map((rule) => {
    const matching = all.filter((l) => {
      if (rule.canonicalKey && l.canonicalKey !== rule.canonicalKey) return false;
      if (rule.productType && l.productType !== rule.productType) return false;
      if (rule.storageGb && l.storageGb !== rule.storageGb) return false;
      if (rule.maxPriceDkk && l.priceDkk > rule.maxPriceDkk) return false;
      if (rule.minDealScore && l.dealScore < rule.minDealScore) return false;
      if (rule.minProfitDkk && (l.netProfitDkk ?? 0) < rule.minProfitDkk) return false;
      return true;
    });

    const targetEstimate = estimates.find(
      (e) =>
        e.canonicalKey === rule.canonicalKey &&
        (rule.storageGb ? e.specKey.endsWith(`|${rule.storageGb}|`) || e.specKey.includes(`|${rule.storageGb}|`) : true)
    );

    const cheapest = matching.length ? Math.min(...matching.map((m) => m.priceDkk)) : null;
    const median = targetEstimate?.medianDkk ?? null;

    return {
      id: rule.id,
      label: rule.label,
      canonicalKey: rule.canonicalKey,
      storageGb: rule.storageGb,
      maxPriceDkk: rule.maxPriceDkk,
      minDealScore: rule.minDealScore,
      minProfitDkk: rule.minProfitDkk,
      productType: rule.productType,
      enabled: rule.enabled,
      createdAt: rule.createdAt,
      lastMatchAt: rule.lastMatchAt,
      currentCheapest: cheapest,
      marketMedian: median,
      difference: cheapest !== null && median ? median - cheapest : null,
      matchingCount: matching.length,
      matchingListings: matching
        .sort((a, b) => b.dealScore - a.dealScore)
        .slice(0, 8)
        .map((m) => ({
          id: m.id,
          title: m.title,
          priceDkk: m.priceDkk,
          dealScore: m.dealScore,
          marketplaceKey: m.marketplaceKey,
          origin: m.origin,
          riskLevel: m.riskLevel,
          velocityLevel: m.velocityLevel,
        })),
    };
  });
}

// ---------------------------------------------------------------------------
// Listing detail
// ---------------------------------------------------------------------------


export function getListingDetail(id: string): ListingDetail | null {
  const row = db.select().from(listings).where(eq(listings.id, id)).get();
  if (!row) return null;
  const settings = getAppSettings();
  if (row.origin === "DEMO" && !settings.demo.enabled) return null;

  const signals = db.select().from(riskSignals).where(eq(riskSignals.listingId, id)).all();
  const snaps = db
    .select()
    .from(listingSnapshots)
    .where(eq(listingSnapshots.listingId, id))
    .orderBy(listingSnapshots.observedAt)
    .all();

  const listing = withDerived(row, signals.length);
  const view: ListingView = { ...listing, origin: effectiveOrigin(listing) };

  const comparables = getAllListings()
    .filter((c) => c.id !== id && !c.duplicateOf && c.specKey === row.specKey)
    .sort((a, b) => a.priceDkk - b.priceDkk)
    .slice(0, 8);

  let factors: ListingDetail["factors"] = {};
  try {
    factors = row.scoreFactors ? JSON.parse(row.scoreFactors) : {};
  } catch {
    factors = {};
  }

  const obs = db
    .select({ origin: priceObservations.origin, n: sql<number>`count(*)` })
    .from(priceObservations)
    .where(eq(priceObservations.canonicalKey, row.canonicalKey ?? ""))
    .groupBy(priceObservations.origin)
    .all();

  return {
    listing: view,
    snapshots: snaps.map((s) => ({ id: s.id, priceDkk: s.priceDkk, observedAt: s.observedAt, title: s.title })),
    signals: signals.map((s) => ({
      code: s.code,
      detail: s.detail,
      severity: s.severity,
      weight: s.weight,
      phrase: s.phrase,
    })),
    comparables,
    factors,
    originBreakdown: obs.map((o) => ({ origin: o.origin, count: Number(o.n) })),
  };
}

// ---------------------------------------------------------------------------
// Flips / analytics
// ---------------------------------------------------------------------------


export function getFlips(): FlipView[] {
  const rows = db.select().from(flips).orderBy(desc(flips.purchaseDate)).all();
  return rows.map((f) => {
    const cost = f.purchasePriceDkk + f.expensesDkk;
    const profit = f.salePriceDkk !== null ? f.salePriceDkk - cost : null;
    const roi = f.salePriceDkk !== null && cost > 0 ? Number((((f.salePriceDkk - cost) / cost) * 100).toFixed(1)) : null;
    const daysHeld = Math.max(0, Math.round(((f.saleDate ?? Date.now()) - f.purchaseDate) / 86400000));
    return { ...f, profit, roi, daysHeld };
  });
}


export function getAnalytics(): AnalyticsSummary {
  const rows = getFlips();
  const closed = rows.filter((r) => r.salePriceDkk !== null);
  const totalInvested = rows.reduce((s, r) => s + r.purchasePriceDkk + r.expensesDkk, 0);
  const revenue = closed.reduce((s, r) => s + (r.salePriceDkk ?? 0), 0);
  const profit = revenue - closed.reduce((s, r) => s + r.purchasePriceDkk + r.expensesDkk, 0);
  const avgProfit = closed.length ? Math.round(profit / closed.length) : 0;
  const avgRoi = closed.length
    ? Number((closed.reduce((s, r) => s + (r.roi ?? 0), 0) / closed.length).toFixed(1))
    : 0;
  const avgHoldingDays = closed.length
    ? Math.round(closed.reduce((s, r) => s + r.daysHeld, 0) / closed.length)
    : 0;

  const byModelMap = new Map<string, { profit: number; count: number; roiSum: number }>();
  for (const f of closed) {
    const key = f.canonicalKey ?? f.productLabel;
    const cur = byModelMap.get(key) ?? { profit: 0, count: 0, roiSum: 0 };
    cur.profit += f.profit ?? 0;
    cur.count += 1;
    cur.roiSum += f.roi ?? 0;
    byModelMap.set(key, cur);
  }
  const byModel = [...byModelMap.entries()]
    .map(([model, v]) => ({
      model: lookupModel(model)?.label ?? model,
      profit: v.profit,
      count: v.count,
      avgRoi: Number((v.roiSum / v.count).toFixed(1)),
    }))
    .sort((a, b) => b.profit - a.profit);

  const byDayMap = new Map<string, { profit: number; count: number }>();
  for (const f of closed) {
    if (!f.saleDate) continue;
    const day = new Date(f.saleDate).toISOString().slice(0, 10);
    const cur = byDayMap.get(day) ?? { profit: 0, count: 0 };
    cur.profit += f.profit ?? 0;
    cur.count += 1;
    byDayMap.set(day, cur);
  }

  return {
    totalInvested,
    revenue,
    profit,
    avgProfit,
    avgRoi,
    bestModel: byModel[0]?.model ?? null,
    avgHoldingDays,
    closedCount: closed.length,
    openCount: rows.length - closed.length,
    winRate: closed.length ? Number(((closed.filter((f) => (f.profit ?? 0) > 0).length / closed.length) * 100).toFixed(0)) : 0,
    byDay: [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, ...v })),
    byModel,
  };
}

// ---------------------------------------------------------------------------
// Alerts / saved searches
// ---------------------------------------------------------------------------

export function getRecentAlerts(limit = 50) {
  return db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(limit).all();
}

export function getSavedSearches() {
  return db.select().from(savedSearches).all();
}

export function observationStats() {
  const total = db.select({ n: sql<number>`count(*)` }).from(priceObservations).get();
  const byOrigin = db
    .select({ origin: priceObservations.origin, n: sql<number>`count(*)` })
    .from(priceObservations)
    .groupBy(priceObservations.origin)
    .all();
  return {
    total: Number(total?.n ?? 0),
    byOrigin: byOrigin.map((o) => ({ origin: o.origin, count: Number(o.n) })),
  };
}

// ---------------------------------------------------------------------------
// Mutations (called from route handlers)
// ---------------------------------------------------------------------------

/** Sets watchlisted/ignored on a listing. Returns false when the id is unknown. */
export function setListingFlag(id: string, flag: "watchlisted" | "ignored", value: boolean): boolean {
  const row = db.select({ id: listings.id }).from(listings).where(eq(listings.id, id)).get();
  if (!row) return false;
  db.update(listings).set({ [flag]: value }).where(eq(listings.id, id)).run();
  return true;
}

export function markContacted(id: string): boolean {
  const row = db.select({ id: listings.id }).from(listings).where(eq(listings.id, id)).get();
  if (!row) return false;
  db.update(listings)
    .set({ contactedAt: Date.now(), status: "contacted" })
    .where(eq(listings.id, id))
    .run();
  return true;
}

export function markPurchased(id: string): boolean {
  const row = db.select({ id: listings.id }).from(listings).where(eq(listings.id, id)).get();
  if (!row) return false;
  db.update(listings)
    .set({ purchasedAt: Date.now(), status: "purchased" })
    .where(eq(listings.id, id))
    .run();
  return true;
}

export function getListingFlags() {
  return db
    .select({ id: listings.id, watchlisted: listings.watchlisted, ignored: listings.ignored })
    .from(listings)
    .all();
}

export function getWatchRules() {
  return db.select().from(watchRules).orderBy(desc(watchRules.createdAt)).all();
}

export function getAlertRules() {
  return db.select().from(alertRules).orderBy(desc(alertRules.createdAt)).all();
}

export function deleteAlertRule(id: string): boolean {
  const row = db.select({ id: alertRules.id }).from(alertRules).where(eq(alertRules.id, id)).get();
  if (!row) return false;
  db.delete(alertRules).where(eq(alertRules.id, id)).run();
  return true;
}

export function setAlertRuleEnabled(id: string, enabled: boolean): boolean {
  const row = db.select({ id: alertRules.id }).from(alertRules).where(eq(alertRules.id, id)).get();
  if (!row) return false;
  db.update(alertRules).set({ enabled }).where(eq(alertRules.id, id)).run();
  return true;
}

export function getFlipById(id: string) {
  return db.select().from(flips).where(eq(flips.id, id)).get() ?? null;
}

export function getNotificationLog(limit = 20) {
  return db.select().from(notificationLog).orderBy(desc(notificationLog.createdAt)).limit(limit).all();
}

export function getMarketplaces() {
  return db.select().from(marketplaces).all();
}

