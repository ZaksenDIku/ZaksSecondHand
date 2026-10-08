import { describe, it, expect } from "vitest";
import { computeDealScore, tierFor, TIER_META, discountComponent, ageComponent, conditionComponent } from "@/lib/core/deal-score";
import type { DealScoreInput } from "@/lib/core/types";

const base: DealScoreInput = {
  discountPct: 20,
  netProfitDkk: 900,
  roiPct: 18,
  listingAgeMinutes: 30,
  marketValue: 6000,
  quickSale: 5200,
  liquidity: 0.8,
  storageDesirability: 0.9,
  condition: "good",
  batteryHealth: 92,
  sellerTrust: 0.7,
  completeness: 0.8,
  distanceKm: 12,
  demandPressure: 0.6,
  riskScore: 15,
};

describe("component curves", () => {
  it("rewards a larger discount, with diminishing returns", () => {
    expect(discountComponent(30)).toBeGreaterThan(discountComponent(10));
    expect(discountComponent(10)).toBeGreaterThan(discountComponent(2));
    expect(discountComponent(2)).toBeGreaterThanOrEqual(0);
    // never negative, never above 1
    expect(discountComponent(-20)).toBeGreaterThanOrEqual(0);
    expect(discountComponent(90)).toBeLessThanOrEqual(1);
  });

  it("favours fresh listings", () => {
    expect(ageComponent(5)).toBeGreaterThan(ageComponent(120));
    expect(ageComponent(120)).toBeGreaterThan(ageComponent(5000));
    expect(ageComponent(5000)).toBeGreaterThan(ageComponent(100000));
    expect(ageComponent(100000)).toBe(0);
  });

  it("ranks conditions", () => {
    expect(conditionComponent("new")).toBeGreaterThan(conditionComponent("good"));
    expect(conditionComponent("good")).toBeGreaterThan(conditionComponent("fair"));
  });
});

describe("DealScore", () => {
  it("stays inside 0-100 for any input", () => {
    const wild: DealScoreInput = {
      ...base,
      discountPct: 900,
      listingAgeMinutes: 0,
      riskScore: 100,
      liquidity: 50,
      completeness: -20,
      demandPressure: 99,
    };
    const r = computeDealScore(wild);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("scores a strong, fresh, low-risk deal above a stale risky one", () => {
    const best = computeDealScore(base);
    const worst = computeDealScore({
      ...base,
      discountPct: 2,
      listingAgeMinutes: 20000,
      riskScore: 85,
      condition: "poor",
      batteryHealth: 62,
      completeness: 0.2,
    });
    expect(best.score).toBeGreaterThan(worst.score);
    expect(worst.tier).toBe("NORMAL");
  });

  it("penalises risk independently of price", () => {
    const lowRisk = computeDealScore({ ...base, riskScore: 0 });
    const highRisk = computeDealScore({ ...base, riskScore: 90 });
    expect(highRisk.score).toBeLessThan(lowRisk.score);
    expect(highRisk.penalty).toBeGreaterThan(0);
    expect(lowRisk.penalty).toBe(0);
  });

  it("is deterministic", () => {
    expect(computeDealScore(base)).toEqual(computeDealScore(base));
  });

  it("records the component breakdown it used", () => {
    const r = computeDealScore(base);
    expect(r.components.discount).toBeGreaterThan(0);
    expect(r.components.age).toBeGreaterThan(0);
    expect(r.components).toHaveProperty("sellerTrust");
  });

  it("reacts to the configured weights", () => {
    const zeroed = computeDealScore(base, {
      discount: 0,
      age: 0,
      resaleStrength: 0,
      liquidity: 0,
      storageDesirability: 0,
      condition: 0,
      battery: 0,
      sellerTrust: 0,
      completeness: 0,
      geography: 0,
      demand: 0,
      riskPenalty: 0,
    });
    expect(zeroed.score).toBe(0);
  });
});

describe("opportunity tiers", () => {
  it("refuses to call a no-discount listing an opportunity, however high the score", () => {
    expect(tierFor(95, 0, {})).toBe("GOOD");
    expect(tierFor(95, 3, {})).toBe("GOOD");
  });

  it("escalates a high score with a real discount to HOT", () => {
    expect(tierFor(95, 18, { ageMinutes: 30, netProfitDkk: 900, roiPct: 20 })).toBe("HOT");
  });

  it("only grants URGENT with a big discount, freshness and margin", () => {
    expect(tierFor(96, 30, { ageMinutes: 30, netProfitDkk: 900, roiPct: 20 })).toBe("URGENT");
    // Too old for URGENT.
    expect(tierFor(96, 30, { ageMinutes: 40000, netProfitDkk: 900, roiPct: 20 })).not.toBe("URGENT");
    // A loss is never URGENT.
    expect(tierFor(96, 30, { ageMinutes: 30, netProfitDkk: -500, roiPct: -8 })).not.toBe("URGENT");
  });

  it("never calls a loss an opportunity", () => {
    expect(tierFor(90, 25, { netProfitDkk: -1000, roiPct: -15 })).toBe("GOOD");
  });

  it("demotes stale listings", () => {
    expect(tierFor(96, 30, { ageMinutes: 40 * 1440, netProfitDkk: 900, roiPct: 20 })).not.toBe("URGENT");
  });

  it("never gives GREAT without any discount", () => {
    expect(tierFor(80, 0, {})).toBe("GOOD");
  });

  it("has metadata for every tier", () => {
    for (const tier of ["NORMAL", "GOOD", "GREAT", "HOT", "URGENT"] as const) {
      expect(TIER_META[tier].symbol).toBeTruthy();
      expect(TIER_META[tier].tone).toBeTruthy();
    }
  });
});
