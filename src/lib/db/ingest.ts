import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./index";
import {
  listings,
  listingSnapshots,
  marketEstimates,
  priceObservations,
  riskSignals,
  sellerReferences,
} from "./schema";
import { applyExplicitFields, parseProduct } from "../core/product-parser";
import { computeEstimate, type RawObservation } from "../core/market-value";
import {computeDealScore} from "../core/deal-score";
import { detectRisk } from "../core/risk-score";
import { computeFlip, resaleTarget } from "../core/flip";
import { computeVelocity } from "../core/velocity";
import { hiddenGemScore } from "../core/hidden-gem";
import { lookupModel } from "../core/catalog";
import { storageDesirability } from "../core/product-parser";
import { titleSimilarity } from "../core/normalize";
import { normalizeUrlKey } from "../core/risk-score";
import { effectiveOrigin, getAppSettings } from "./settings";
import type { DealTier } from "../core/types";
import type { RawListingRecord } from "../providers/types";
import { evaluateAlerts } from "./alerts";
import { newId } from "./ids";


function originAllowed(origin: string): boolean {
  const settings = getAppSettings();
  if (origin === "DEMO") return settings.demo.enabled;
  return true;
}

export function loadObservations(canonicalKey: string): RawObservation[] {
  const rows = db
    .select()
    .from(priceObservations)
    .where(eq(priceObservations.canonicalKey, canonicalKey))
    .all();
  return rows
    .filter((r) => originAllowed(r.origin))
    .map((r) => ({
      specKey: r.specKey,
      canonicalKey: r.canonicalKey,
      priceDkk: r.priceDkk,
      condition: r.condition,
      batteryHealth: r.batteryHealth,
      observedAt: r.observedAt,
      origin: r.origin,
    }));
}

export function estimateForSpec(
  specKey: string,
  canonicalKey: string,
  storageGb: number | null,
  condition: string | null,
  batteryHealth: number | null
) {
  return computeEstimate({
    specKey,
    canonicalKey,
    observations: loadObservations(canonicalKey),
    storageGb,
    condition,
    batteryHealth,
  });
}

function sellerTrustScore(handle: string | null): number {
  if (!handle) return 0.5;
  const ref = db
    .select()
    .from(sellerReferences)
    .where(eq(sellerReferences.handle, handle))
    .get();
  if (!ref) return 0.55;
  let score = 0.7;
  score += Math.min(0.2, ref.listingCount * 0.04);
  if (ref.rating !== null && ref.rating !== undefined) {
    score = Math.max(score, Math.min(0.95, ref.rating / 5));
  }
  if (ref.riskNotes) score = Math.max(0.15, score - 0.35);
  return Number(score.toFixed(2));
}

function completenessScore(row: {
  title: string;
  description: string;
  imageUrl: string | null;
  location: string | null;
  storageGb: number | null;
  condition: string | null;
  productType: string | null;
  batteryHealth: number | null;
}): number {
  const checks = [
    row.title.length > 10,
    row.description.trim().length > 40,
    Boolean(row.imageUrl),
    Boolean(row.location),
    Boolean(row.storageGb),
    row.condition !== null && row.condition !== "unknown",
    row.productType === "macbook" ? Boolean(row.batteryHealth) || true : Boolean(row.batteryHealth),
  ];
  return Number((checks.filter(Boolean).length / checks.length).toFixed(2));
}

export interface AnalysisResult {
  velocity: { level: string; score: number; reason: string };
  hiddenGemScore: number;
  dealScore: number;
  dealTier: DealTier;
  riskScore: number;
  riskLevel: string;
  discountPct: number | null;
  marketValue: number | null;
  quickSale: number | null;
  netProfit: number | null;
  roiPct: number | null;
}

export function analyzeListing(listingId: string, now = Date.now()): AnalysisResult | null {
  const row = db.select().from(listings).where(eq(listings.id, listingId)).get();
  if (!row) return null;

  const settings = getAppSettings();
  const est = estimateForSpec(
    row.specKey ?? "",
    row.canonicalKey ?? "unknown:unknown",
    row.storageGb,
    row.condition,
    row.batteryHealth
  );

  const discountPct =
    est.fairValue && est.fairValue > 0
      ? Number((((est.fairValue - row.priceDkk) / est.fairValue) * 100).toFixed(1))
      : null;

  const risk = detectRisk({
    title: row.rawTitle,
    description: row.description,
    priceDkk: row.priceDkk,
    marketValue: est.fairValue,
    hasImage: Boolean(row.imageUrl),
    imageUrl: row.imageUrl,
    hasLocation: Boolean(row.location),
    hasStorage: row.storageGb !== null,
    hasCondition: row.condition !== null && row.condition !== "unknown",
    sellerTrusted: row.sellerHandle ? sellerTrustScore(row.sellerHandle) > 0.5 : null,
    parsedModel: row.model,
    titleMentionsModel: row.model
      ? titleSimilarity(row.rawTitle, row.model) > 0.35 ||
        row.rawTitle.toLowerCase().includes(row.model.toLowerCase())
      : null,
  });

  const modelDef = lookupModel(row.canonicalKey ?? "");
  const demandRows = row.specKey
    ? db
        .select({ id: listings.id })
        .from(listings)
        .where(and(eq(listings.specKey, row.specKey), eq(listings.status, "active")))
        .all()
    : [];
  const demandPressure = Math.min(1, demandRows.length / 25);

  const ageMin = row.postedAt ? Math.max(0, (now - row.postedAt) / 60000) : 60 * 24 * 10;
  const resalePre = resaleTarget(est.fairValue, est.quickSale);
  const flipPre = computeFlip({
    purchasePrice: row.priceDkk,
    platformFeePct: settings.flip.platformFeePct,
    transportDkk: settings.flip.transportDkk,
    repairAllowanceDkk: settings.flip.repairAllowanceDkk,
    negotiationAdjustmentDkk: 0,
    expectedResale: resalePre ?? row.priceDkk,
  });

  const score = computeDealScore(
    {
      discountPct,
      netProfitDkk: resalePre ? flipPre.netProfit : null,
      roiPct: resalePre ? flipPre.roiPct : null,
      listingAgeMinutes: ageMin,
      marketValue: est.fairValue,
      quickSale: est.quickSale,
      liquidity: modelDef?.liquidity ?? 0.5,
      storageDesirability:
        row.productType === "macbook"
          ? storageDesirability(row.storageGb, "macbook")
          : storageDesirability(row.storageGb, "iphone"),
      condition: (row.condition ?? "unknown") as never,
      batteryHealth: row.batteryHealth,
      sellerTrust: sellerTrustScore(row.sellerHandle),
      completeness: completenessScore(row),
      distanceKm: row.distanceKm,
      demandPressure,
      riskScore: risk.score,
    },
    settings.weights
  );

  const resale = resalePre;
  const flip = flipPre;

  const velocity = computeVelocity({
    postedAt: row.postedAt,
    now,
    discountPct,
    dealScore: score.score,
    sampleCount: est.sampleCount,
    priceDkk: row.priceDkk,
    marketMedianDkk: est.median,
    productType: (row.productType as never) ?? null,
  });

  const gem = hiddenGemScore({
    rawTitle: row.rawTitle,
    description: row.description,
    title: row.title,
    parseConfidence: row.parseConfidence,
    parseAmbiguous: row.parseAmbiguous,
    discountPct,
    productType: row.productType,
    storageGb: row.storageGb,
    ramGb: row.ramGb,
    condition: row.condition,
    batteryHealth: row.batteryHealth,
    descriptionLength: row.description.length,
  });

  db.update(listings)
    .set({
      velocityLevel: velocity.level,
      velocityScore: velocity.score,
      hiddenGemScore: gem.score,
      aiParsed: row.parseAmbiguous || row.parseConfidence < 0.55,
      marketValueDkk: est.fairValue,
      quickSaleValueDkk: est.quickSale,
      estimateSample: est.sampleCount,
      estimateConfidence: est.confidence,
      discountPct,
      dealScore: score.score,
      dealTier: score.tier,
      riskScore: risk.score,
      riskLevel: risk.level,
      grossProfitDkk: flip.grossProfit,
      netProfitDkk: resale ? flip.netProfit : null,
      roiPct: resale ? flip.roiPct : null,
      totalCostDkk: flip.totalCost,
      scoreFactors: JSON.stringify({
        components: score.components,
        weights: score.weights,
        penalty: score.penalty,
        estimateBasis: est.basis,
        trend7Pct: est.trend7Pct,
        trend30Pct: est.trend30Pct,
        velocity: { level: velocity.level, score: velocity.score, reason: velocity.reason },
        hiddenGem: { score: gem.score, reasons: gem.reasons, hypothesis: gem.hypothesis },
      }),
    })
    .where(eq(listings.id, listingId))
    .run();

  const estRow = db
    .select()
    .from(marketEstimates)
    .where(eq(marketEstimates.specKey, est.specKey))
    .get();
  const estValues = {
    canonicalKey: est.canonicalKey,
    sampleCount: est.sampleCount,
    medianDkk: est.median,
    p25Dkk: est.p25,
    p75Dkk: est.p75,
    avgDkk: est.avg,
    minDkk: est.min,
    maxDkk: est.max,
    fairValueDkk: est.fairValue,
    quickSaleDkk: est.quickSale,
    trend7Pct: est.trend7Pct,
    trend30Pct: est.trend30Pct,
    confidence: est.confidence,
    updatedAt: now,
  };
  if (estRow) {
    db.update(marketEstimates).set(estValues).where(eq(marketEstimates.specKey, est.specKey)).run();
  } else {
    db.insert(marketEstimates).values({ specKey: est.specKey, ...estValues }).run();
  }

  db.delete(riskSignals).where(eq(riskSignals.listingId, listingId)).run();
  if (risk.signals.length > 0) {
    db.insert(riskSignals)
      .values(
        risk.signals.map((s) => ({
          id: newId("risk"),
          listingId,
          code: s.code,
          phrase: s.phrase,
          severity: s.severity,
          weight: s.weight,
          detail: s.detail,
          createdAt: now,
        }))
      )
      .run();
  }

  return {
    velocity: { level: velocity.level, score: velocity.score, reason: velocity.reason },
    hiddenGemScore: gem.score,
    dealScore: score.score,
    dealTier: score.tier,
    riskScore: risk.score,
    riskLevel: risk.level,
    discountPct,
    marketValue: est.fairValue,
    quickSale: est.quickSale,
    netProfit: resale ? flip.netProfit : null,
    roiPct: resale ? flip.roiPct : null,
  };
}

function findExisting(record: RawListingRecord, marketplaceKey: string) {
  if (record.externalId) {
    const byExt = db
      .select()
      .from(listings)
      .where(and(eq(listings.marketplaceKey, marketplaceKey), eq(listings.externalId, record.externalId)))
      .get();
    if (byExt) return byExt;
  }
  const urlKey = normalizeUrlKey(record.url);
  if (urlKey) {
    const all = db
      .select()
      .from(listings)
      .where(eq(listings.marketplaceKey, marketplaceKey))
      .limit(500)
      .all();
    const match = all.find((l) => normalizeUrlKey(l.url) === urlKey);
    if (match) return match;
  }
  return null;
}

function findDuplicate(
  record: RawListingRecord,
  parsed: ReturnType<typeof parseProduct>,
  listingId: string
): { id: string; confidence: number } | null {
  const candidates = db
    .select()
    .from(listings)
    .where(eq(listings.canonicalKey, parsed.canonicalKey))
    .limit(400)
    .all()
    .filter((l) => l.id !== listingId);

  let best: { id: string; confidence: number } | null = null;
  for (const c of candidates) {
    const urlA = normalizeUrlKey(record.url);
    const urlB = normalizeUrlKey(c.url);
    if (urlA && urlB && urlA === urlB) return { id: c.id, confidence: 0.99 };

    const priceGap = Math.abs(c.priceDkk - record.priceDkk) / Math.max(c.priceDkk, record.priceDkk, 1);
    if (priceGap > 0.1) continue;
    const sim = titleSimilarity(c.rawTitle, record.rawTitle);
    const sameSeller =
      record.sellerHandle && c.sellerHandle && record.sellerHandle === c.sellerHandle;
    const sameLocation =
      record.location && c.location &&
      record.location.trim().toLowerCase() === c.location.trim().toLowerCase();
    const confidence =
      sim * 0.5 +
      (priceGap <= 0.03 ? 0.25 : 0.12) +
      (c.storageGb && c.storageGb === parsed.storageGb ? 0.12 : 0) +
      (sameSeller ? 0.1 : 0) +
      (sameLocation ? 0.05 : 0);
    if (confidence >= 0.68 && (!best || confidence > best.confidence)) {
      best = { id: c.id, confidence: Number(confidence.toFixed(2)) };
    }
  }
  return best;
}

export interface IngestSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function ingestRecord(
  record: RawListingRecord,
  providerKey: string
): Promise<"created" | "updated" | "skipped"> {
  if (!record.priceDkk || record.priceDkk <= 0) return "skipped";
  const now = Date.now();
  // Attribution order: what the import stated, then what the URL proves, then
  // the provider we happened to import through. Never silently claims a
  // marketplace the data does not support.
  const fromUrl = (() => {
    if (!record.url) return null;
    const u = record.url.toLowerCase();
    if (/facebook|fb\.com/.test(u)) return "facebook";
    if (/vinted/.test(u)) return "vinted";
    if (/dba\.dk|guloggratis/.test(u)) return "dba";
    if (/trendsales/.test(u)) return "trendsales";
    return null;
  })();
  const stated = record.marketplaceKey?.trim().toLowerCase();
  const marketplaceKey =
    (stated && /^[a-z][a-z0-9_-]{0,19}$/.test(stated) ? stated : null) ?? fromUrl ?? providerKey;

  let parsed = parseProduct({
    title: record.rawTitle,
    description: record.description ?? "",
  });
  if (record.explicit) parsed = applyExplicitFields(parsed, record.explicit as never);

  const existing = findExisting(record, marketplaceKey);

  if (existing) {
    const priceChanged = existing.priceDkk !== record.priceDkk;
    if (priceChanged) {
      // Snapshot the price we just observed. The previous price already has a
      // snapshot from when it was first seen, so recording the old value here
      // would duplicate it and hide the current one from the history chart.
      db.insert(listingSnapshots)
        .values({
          id: newId("snap"),
          listingId: existing.id,
          priceDkk: record.priceDkk,
          title: existing.title,
          imageUrl: existing.imageUrl,
          observedAt: now,
          origin: record.origin,
        })
        .run();
    }
    db.update(listings)
      .set({
        priceDkk: record.priceDkk,
        priceChangedFrom: priceChanged ? existing.priceDkk : existing.priceChangedFrom,
        lastSeenAt: now,
        title: parsed.model !== "Ukendt produkt" ? `${parsed.model}` : existing.title,
        description: record.description ?? existing.description,
        imageUrl: record.imageUrl ?? existing.imageUrl,
        snapshotCount: existing.snapshotCount + (priceChanged ? 1 : 0),
        origin: record.origin === "DEMO" ? existing.origin : existing.origin,
      })
      .where(eq(listings.id, existing.id))
      .run();
    analyzeListing(existing.id, now);
    return "updated";
  }

  const duplicate = findDuplicate(record, parsed, "new");
  const id = newId("lst");

  db.insert(listings)
    .values({
      id,
      marketplaceKey,
      externalId: record.externalId ?? null,
      url: record.url ?? null,
      title: parsed.model !== "Ukendt produkt" ? parsed.model : record.rawTitle.slice(0, 80),
      rawTitle: record.rawTitle,
      description: record.description ?? "",
      priceDkk: record.priceDkk,
      imageUrl: record.imageUrl ?? null,
      location: record.location ?? null,
      postedAt: record.postedAt ?? now,
      firstSeenAt: now,
      lastSeenAt: now,
      origin: record.origin,
      providerStatus: "MANUAL",
      productType: parsed.productType,
      brand: parsed.brand,
      model: parsed.model,
      generation: parsed.generation,
      variant: parsed.variant,
      storageGb: parsed.storageGb,
      ramGb: parsed.ramGb,
      chip: parsed.chip,
      screenSize: parsed.screenSize,
      color: parsed.color,
      year: parsed.year,
      condition: parsed.condition,
      batteryHealth: parsed.batteryHealth,
      parseConfidence: parsed.confidence,
      parseAmbiguous: parsed.ambiguous,
      canonicalKey: parsed.canonicalKey,
      specKey: parsed.specKey,
      duplicateOf: duplicate?.id ?? null,
      duplicateConfidence: duplicate?.confidence ?? null,
      fingerprint: record.externalId
        ? `${marketplaceKey}:${record.externalId}`
        : (normalizeUrlKey(record.url) ?? `${parsed.canonicalKey}:${record.priceDkk}`),
      sellerHandle: record.sellerHandle ?? null,
      sellerMeta: record.sellerMeta ? JSON.stringify(record.sellerMeta) : null,
      distanceKm: record.distanceKm ?? null,
      status: "active",
    })
    .run();

  db.insert(listingSnapshots)
    .values({
      id: newId("snap"),
      listingId: id,
      priceDkk: record.priceDkk,
      title: record.rawTitle,
      imageUrl: record.imageUrl ?? null,
      observedAt: now,
      origin: record.origin,
    })
    .run();

  db.insert(priceObservations)
    .values({
      id: newId("obs"),
      specKey: parsed.specKey,
      canonicalKey: parsed.canonicalKey,
      priceDkk: record.priceDkk,
      condition: parsed.condition,
      batteryHealth: parsed.batteryHealth,
      marketplaceKey,
      origin: record.origin,
      listingId: id,
      observedAt: record.postedAt ?? now,
    })
    .run();

  if (record.sellerHandle) {
    const existingSeller = db
      .select()
      .from(sellerReferences)
      .where(eq(sellerReferences.handle, record.sellerHandle))
      .get();
    if (existingSeller) {
      db.update(sellerReferences)
        .set({ listingCount: existingSeller.listingCount + 1, lastSeenAt: now })
        .where(eq(sellerReferences.id, existingSeller.id))
        .run();
    } else {
      db.insert(sellerReferences)
        .values({
          id: newId("sel"),
          marketplaceKey,
          handle: record.sellerHandle,
          display: record.sellerHandle,
          listingCount: 1,
          meta: record.sellerMeta ? JSON.stringify(record.sellerMeta) : null,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .run();
    }
  }

  const analysis = analyzeListing(id, now);
  if (analysis) await evaluateAlerts(id, analysis, now);
  return "created";
}

export { effectiveOrigin };

export async function ingestBatch(
  records: RawListingRecord[],
  providerKey: string
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const record of records) {
    try {
      const result = await ingestRecord(record, providerKey);
      if (result === "created") created++;
      else if (result === "updated") updated++;
      else skipped++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { created, updated, skipped, errors };
}

/** Recomputes derived values after a settings change (weights, flip costs...). */
export function reanalyzeAll(limit = 500): number {
  const rows = db
    .select({ id: listings.id })
    .from(listings)
    .where(ne(listings.origin, "DEMO"))
    .limit(limit)
    .all();
  const demo = getAppSettings().demo.enabled
    ? db.select({ id: listings.id }).from(listings).where(eq(listings.origin, "DEMO")).limit(limit).all()
    : [];
  let count = 0;
  for (const r of [...rows, ...demo]) {
    analyzeListing(r.id);
    count++;
  }
  return count;
}

export function observationCount(): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(priceObservations).get();
  return Number(row?.n ?? 0);
}
