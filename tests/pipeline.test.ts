import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * End-to-end pipeline test. Runs against a throwaway SQLite file so the real
 * local database is never touched.
 */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zaks-test-"));
process.env.DATABASE_URL = `file:${path.join(tmpDir, "test.sqlite")}`;

let ingest: typeof import("@/lib/db/ingest");
let queries: typeof import("@/lib/db/queries");
let bootstrap: typeof import("@/lib/db/bootstrap");
let settings: typeof import("@/lib/db/settings");
let alerts: typeof import("@/lib/db/alerts");
let flips: typeof import("@/lib/db/flips");
let db: typeof import("@/lib/db/index").db;
let watchRules: typeof import("@/lib/db/schema").watchRules;
let newId: typeof import("@/lib/db/ids").newId;

beforeAll(async () => {
  ({ db } = await import("@/lib/db/index"));
  ({ watchRules } = await import("@/lib/db/schema"));
  ({ newId } = await import("@/lib/db/ids"));
  bootstrap = await import("@/lib/db/bootstrap");
  settings = await import("@/lib/db/settings");
  ingest = await import("@/lib/db/ingest");
  queries = await import("@/lib/db/queries");
  alerts = await import("@/lib/db/alerts");
  flips = await import("@/lib/db/flips");
  await bootstrap.ensureBootstrap();
  settings.updateAppSettings({ setupComplete: true, demo: { enabled: false } });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const baseListing = {
  rawTitle: "iPhone 16 Pro Max 256GB",
  description:
    "Meget fin stand, ny i 2025. Kvittering medfølger. Flytter grundet nyt job. Ingen ridser, skærm er perfekt.",
  priceDkk: 4200,
  url: "https://www.dba.dk/iphone-16-pro-max-256-1",
  location: "København K",
  origin: "IMPORTED" as const,
};

describe("ingest → estimate → score", () => {
  it("parses, estimates and scores a listing on first import", async () => {
    const r = await ingest.ingestBatch([baseListing], "dba");
    expect(r.created).toBe(1);
    expect(r.errors).toHaveLength(0);

    const all = queries.getAllListings();
    expect(all).toHaveLength(1);
    const l = all[0];
    expect(l.productType).toBe("iphone");
    expect(l.canonicalKey).toBe("iphone:16-pro-max");
    expect(l.storageGb).toBe(256);
    expect(l.origin).toBe("IMPORTED");
    expect(Number.isFinite(l.dealScore)).toBe(true);
    expect(l.dealScore).toBeGreaterThanOrEqual(0);
    expect(l.dealScore).toBeLessThanOrEqual(100);
    expect(l.velocityLevel).toBeTruthy();
  });

  it("updates rather than duplicates when the same URL is re-imported", async () => {
    const r = await ingest.ingestBatch([{ ...baseListing, priceDkk: 3900 }], "dba");
    expect(r.created).toBe(0);
    expect(r.updated).toBe(1);
    const all = queries.getAllListings();
    expect(all).toHaveLength(1);
    expect(all[0].priceDkk).toBe(3900);
  });

  it("records a price series that ends at the current price", async () => {
    const l = queries.getAllListings()[0];
    const before = l.snapshotCount;
    await ingest.ingestBatch([{ ...baseListing, priceDkk: 3600 }], "dba");

    const after = queries.getAllListings()[0];
    expect(after.snapshotCount).toBeGreaterThan(before);
    expect(after.priceChangedFrom).toBe(3900);

    // The history must be a real series: strictly observed prices ending at the
    // price the listing carries now, with no repeated stale value.
    const snaps = queries.getListingDetail(after.id)!.snapshots;
    const series = snaps.map((s) => s.priceDkk);
    expect(series[series.length - 1]).toBe(after.priceDkk);
    expect(new Set(series).size).toBe(series.length);
  });

  it("builds a market estimate once comparable listings exist", async () => {
    for (let i = 0; i < 6; i++) {
      await ingest.ingestBatch(
        [
          {
            ...baseListing,
            url: `https://www.dba.dk/iphone-16-pro-max-256-cmp-${i}`,
            externalId: `cmp-${i}`,
            priceDkk: 5000 + i * 200,
          },
        ],
        "dba"
      );
    }
    const target = queries.getAllListings().find((l) => l.canonicalKey === "iphone:16-pro-max")!;
    expect(target.marketValueDkk).toBeGreaterThan(0);
    expect(target.estimateSample).toBeGreaterThan(0);

    const detail = queries.getListingDetail(target.id)!;
    expect(detail.comparables.length).toBeGreaterThan(0);
    expect(detail.factors.estimateBasis).toBeTruthy();
  });

  it("adds a row rather than overwriting when the same item appears on a second marketplace", async () => {
    const before = queries.getAllListings().length;
    await ingest.ingestBatch(
      [
        {
          ...baseListing,
          url: "https://www.vinted.dk/items/abc/iphone-16-pro-max-256",
          externalId: "vinted-1",
        },
      ],
      "vinted"
    );
    expect(queries.getAllListings().length).toBe(before + 1);
  });

  it("never marks a listing as REAL without a real provider", () => {
    expect(queries.getAllListings().filter((l) => l.origin === "REAL")).toHaveLength(0);
  });
});

describe("watch rules and alert evaluation", () => {
  it("creates a watch rule and matches listings against it", () => {
    const id = newId("wr");
    db.insert(watchRules)
      .values({
        id,
        label: "iPhone 16 Pro Max 256",
        productType: "iphone",
        canonicalKey: "iphone:16-pro-max",
        storageGb: 256,
        maxPriceDkk: 4500,
        minDealScore: null,
        minProfitDkk: null,
        enabled: true,
        createdAt: Date.now(),
      })
      .run();

    const rule = queries.getWatchlist().find((r) => r.id === id)!;
    expect(rule).toBeTruthy();
    expect(rule.matchingCount).toBeGreaterThan(0);
    expect(rule.marketMedian).toBeGreaterThan(0);
    expect(rule.currentCheapest).toBeGreaterThan(0);
  });

  it("fires an alert when a rule threshold is crossed", async () => {
    const ruleId = alerts.createAlertRule({
      name: "Lavt prisloft",
      kind: "price_below",
      threshold: 999999,
      canonicalKey: "iphone:16-pro-max",
      productType: "iphone",
      enabled: true,
      cooldownMinutes: 0,
    });
    const target = queries.getAllListings()[0];
    const analysis = ingest.analyzeListing(target.id)!;
    const fired = await alerts.evaluateAlerts(target.id, analysis);
    expect(fired).toBeGreaterThan(0);
    expect(queries.getRecentAlerts(50).some((a) => a.ruleId === ruleId)).toBe(true);
  });

  it("suppresses repeat alerts for unchanged facts but fires on real changes", async () => {
    const rec = {
      rawTitle: "iPhone 16 Pro Max 256GB",
      description: "Laest enhed, kan ikke testes, depositum.",
      priceDkk: 4200,
      url: "https://www.dba.dk/dedup-1",
      origin: "IMPORTED" as const,
    };
    await ingest.ingestBatch([rec], "dba");
    const listing = queries.getAllListings().find((l) => l.url === rec.url)!;

    const run = async () => {
      const a = ingest.analyzeListing(listing.id)!;
      return alerts.evaluateAlerts(listing.id, a);
    };

    // A price drop and a blocking risk both fire on the first pass.
    expect(await run()).toBeGreaterThan(0);

    // Re-analysing identical data must not repeat any standing condition.
    const STANDING = ["PRICE_DROP", "HIDDEN_GEM", "RISK_CHANGE", "TARGET_HIT"];
    const standingCount = () => queries.getRecentAlerts(200).filter((a) => STANDING.includes(a.category)).length;
    const afterFirstStanding = standingCount();
    expect(await run()).toBeGreaterThanOrEqual(0);
    expect(standingCount()).toBe(afterFirstStanding);
    expect(await run()).toBeGreaterThanOrEqual(0);
    expect(standingCount()).toBe(afterFirstStanding);

    // A genuine price change is new information and must alert again.
    await ingest.ingestBatch([{ ...rec, priceDkk: 3200 }], "dba");
    await run();
    expect(standingCount()).toBeGreaterThan(afterFirstStanding);
  });

  it("never fires an alert for DEMO data", async () => {
    const before = queries.getRecentAlerts(200).length;
    settings.updateAppSettings({ demo: { enabled: true } });
    const { seedDemoFixtures } = await import("@/lib/db/demo");
    await seedDemoFixtures();

    const demoListing = queries.getAllListings().find((l) => l.origin === "DEMO")!;
    expect(demoListing).toBeTruthy();
    const analysis = ingest.analyzeListing(demoListing.id)!;
    const fired = await alerts.evaluateAlerts(demoListing.id, analysis);
    expect(fired).toBe(0);
    expect(queries.getRecentAlerts(200).length).toBe(before);
  });
});

describe("flip lifecycle", () => {
  it("registers a purchase, then a sale, and computes profit", () => {
    const l = queries.getAllListings()[0];
    const flipId = flips.createFlip({
      listingId: l.id,
      productLabel: l.title,
      canonicalKey: l.canonicalKey,
      purchasePriceDkk: 3600,
      purchaseDate: Date.now() - 5 * 86400000,
      offerDkk: 5200,
      status: "PURCHASED",
    });
    expect(typeof flipId).toBe("string");

    const updated = flips.updateFlip(flipId, { salePriceDkk: 5000, saleDate: Date.now(), status: "SOLD" });
    expect(updated).toBe(true);

    const view = queries.getFlips().find((f) => f.id === flipId)!;
    expect(view.status).toBe("SOLD");
    expect(view.profit).toBeGreaterThan(0);
    expect(view.roi).toBeGreaterThan(0);
    expect(view.daysHeld).toBeGreaterThanOrEqual(5);
  });

  it("feeds the analytics summary", () => {
    const a = queries.getAnalytics();
    expect(a.closedCount).toBeGreaterThan(0);
    expect(a.revenue).toBeGreaterThan(0);
    expect(a.profit).toBeGreaterThan(0);
    expect(a.byModel.length).toBeGreaterThan(0);
  });
});

describe("market intel and listing detail", () => {
  it("produces heatmap rows with a median and buy-below guidance", () => {
    const rows = queries.getHeatmap("iphone");
    expect(rows.length).toBeGreaterThan(0);
    const withMedian = rows.find((r) => r.median !== null)!;
    expect(withMedian).toBeTruthy();
    expect(withMedian.buyBelow!).toBeLessThan(withMedian.median!);
    expect(withMedian.stealBelow!).toBeLessThan(withMedian.buyBelow!);
  });

  it("returns full detail for a known listing and null for an unknown one", () => {
    const l = queries.getAllListings()[0];
    const detail = queries.getListingDetail(l.id)!;
    expect(detail).not.toBeNull();
    expect(detail.listing.id).toBe(l.id);
    expect(detail.snapshots.length).toBeGreaterThan(0);
    expect(detail.originBreakdown.length).toBeGreaterThan(0);
    expect(queries.getListingDetail("does-not-exist")).toBeNull();
  });
});
