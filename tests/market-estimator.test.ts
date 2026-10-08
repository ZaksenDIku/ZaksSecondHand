import { describe, it, expect } from "vitest";
import { computeEstimate, median, percentile, parseSpecKey, unitPrice, heatRowFromEstimate } from "@/lib/core/market-value";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const day = 86400000;

function obs(priceDkk: number, daysAgo: number, specKey = "iphone:16-pro-max|256|good") {
  return {
    specKey,
    canonicalKey: "iphone:16-pro-max",
    priceDkk,
    observedAt: NOW - daysAgo * day,
  };
}

describe("stat helpers", () => {
  it("computes a median for odd and even sample sizes", () => {
    expect(median([10, 20, 30])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    // An empty sample yields 0; callers must check sampleCount, not the median.
    expect(median([])).toBe(0);
  });

  it("computes an ordered percentile pair", () => {
    const sorted = [1, 2, 3, 4];
    expect(percentile(sorted, 0.25)).toBeLessThanOrEqual(percentile(sorted, 0.75));
  });

  it("round-trips a specKey", () => {
    const p = parseSpecKey("iphone:16-pro-max|256|good");
    expect(p.canonicalKey).toBe("iphone:16-pro-max");
    expect(p.storageGb).toBe(256);
    expect(p.condition).toBe("good");
  });

  it("normalizes a poor-condition listing up to a good-condition unit price", () => {
    // Same sticker price, worse condition -> a worse unit price for the same
    // physical configuration, so it can be compared on one axis.
    const poor = unitPrice({ specKey: "iphone:16|256|poor", canonicalKey: "iphone:16", priceDkk: 5000, observedAt: NOW });
    const good = unitPrice({ specKey: "iphone:16|256|good", canonicalKey: "iphone:16", priceDkk: 5000, observedAt: NOW });
    expect(poor).toBeGreaterThan(good);
  });

  it("prices a larger storage tier higher on the same unit axis", () => {
    const small = unitPrice({ specKey: "iphone:16|128|good", canonicalKey: "iphone:16", priceDkk: 5000, observedAt: NOW });
    const large = unitPrice({ specKey: "iphone:16|512|good", canonicalKey: "iphone:16", priceDkk: 5000, observedAt: NOW });
    expect(small).toBeGreaterThan(large);
  });
});

describe("market estimate uses observed data only", () => {
  it("returns no estimate when there are no observations", () => {
    const r = computeEstimate({
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: [],
      now: NOW,
    });
    expect(r.fairValue).toBeNull();
    expect(r.quickSale).toBeNull();
    expect(r.basis).toBe("NONE");
    expect(r.confidence).toBe("NONE");
    expect(r.sampleCount).toBe(0);
  });

  it("builds a direct estimate from an exact spec match", () => {
    const r = computeEstimate({
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: [obs(5000, 1), obs(6000, 3), obs(7000, 5), obs(4000, 9), obs(9000, 20)],
      now: NOW,
    });
    expect(r.basis).toBe("DIRECT");
    expect(r.sampleCount).toBe(5);
    expect(r.fairValue).toBeGreaterThan(0);
    expect(r.fairValue!).toBeGreaterThanOrEqual(r.p25!);
    expect(r.fairValue!).toBeLessThanOrEqual(r.p75!);
  });

  it("is deterministic: the same observations always give the same estimate", () => {
    const input = {
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: [obs(5000, 1), obs(6000, 3), obs(7000, 5), obs(4000, 9)],
      now: NOW,
    };
    expect(computeEstimate(input)).toEqual(computeEstimate(input));
  });

  it("reacts to data: cheaper observations pull the estimate down", () => {
    const base = { specKey: "iphone:16-pro-max|256|good", canonicalKey: "iphone:16-pro-max", now: NOW };
    const before = computeEstimate({
      ...base,
      observations: [obs(6000, 1), obs(6000, 2), obs(6000, 3), obs(6000, 4), obs(6000, 5)],
    });
    const after = computeEstimate({
      ...base,
      observations: [obs(6000, 1), obs(6000, 2), obs(3000, 3), obs(3000, 4), obs(3000, 5)],
    });
    expect(after.fairValue!).toBeLessThan(before.fairValue!);
  });

  it("uses a median, so a single cheap outlier barely moves the estimate", () => {
    const base = { specKey: "iphone:16-pro-max|256|good", canonicalKey: "iphone:16-pro-max", now: NOW };
    const before = computeEstimate({
      ...base,
      observations: [obs(6000, 1), obs(6000, 2), obs(6000, 3), obs(6000, 4), obs(6000, 5)],
    });
    const after = computeEstimate({
      ...base,
      observations: [obs(6000, 1), obs(6000, 2), obs(6000, 3), obs(6000, 4), obs(1000, 5)],
    });
    expect(after.fairValue).toBe(before.fairValue);
  });

  it("reports a DIRECT median that matches the observed prices", () => {
    const r = computeEstimate({
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: [obs(6000, 1), obs(6000, 2), obs(6000, 3), obs(6000, 4)],
      now: NOW,
    });
    expect(r.basis).toBe("DIRECT");
    expect(r.fairValue).toBe(6000);
  });

  it("flags confidence from sample size", () => {
    const many = computeEstimate({
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: Array.from({ length: 30 }, (_, i) => obs(5000 + i, 1 + i)),
      now: NOW,
    });
    const few = computeEstimate({
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: [obs(5000, 1), obs(6000, 2)],
      now: NOW,
    });
    expect(many.confidence).toBe("HIGH");
    expect(few.confidence).toBe("LOW");
  });

  it("keeps quick sale below fair value", () => {
    const r = computeEstimate({
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: Array.from({ length: 12 }, (_, i) => obs(4000 + i * 300, 1 + i)),
      now: NOW,
    });
    expect(r.quickSale!).toBeLessThanOrEqual(r.fairValue!);
  });

  it("falls back to a canonical, unit-normalised basis when the exact spec has no data", () => {
    const r = computeEstimate({
      specKey: "iphone:16-pro-max|1024|good",
      canonicalKey: "iphone:16-pro-max",
      storageGb: 1024,
      observations: [
        obs(5000, 1, "iphone:16-pro-max|256|good"),
        obs(6000, 3, "iphone:16-pro-max|256|good"),
        obs(7000, 5, "iphone:16-pro-max|256|good"),
        obs(4000, 9, "iphone:16-pro-max|128|good"),
        obs(9000, 20, "iphone:16-pro-max|512|good"),
      ],
      now: NOW,
    });
    expect(r.basis).toBe("CANONICAL");
    expect(r.fairValue!).toBeGreaterThan(0);
  });

  it("prices a 1TB variant above a 256GB variant from the same model pool", () => {
    const observations = [
      obs(5000, 1, "iphone:16-pro-max|256|good"),
      obs(6000, 3, "iphone:16-pro-max|256|good"),
      obs(7000, 5, "iphone:16-pro-max|256|good"),
      obs(4000, 9, "iphone:16-pro-max|128|good"),
      obs(9000, 20, "iphone:16-pro-max|512|good"),
    ];
    const common = { canonicalKey: "iphone:16-pro-max", observations, now: NOW };
    const small = computeEstimate({ ...common, specKey: "iphone:16-pro-max|256|good" });
    const large = computeEstimate({ ...common, specKey: "iphone:16-pro-max|1024|good", storageGb: 1024 });
    expect(large.fairValue!).toBeGreaterThan(small.fairValue!);
  });

  it("derives buy-below and steal-below strictly below the median", () => {
    const est = computeEstimate({
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: Array.from({ length: 12 }, (_, i) => obs(4000 + i * 250, 1 + i)),
      now: NOW,
    });
    const row = heatRowFromEstimate(est, "iPhone 16 Pro Max 256GB", 256);
    expect(row.buyBelow!).toBeLessThan(row.median!);
    expect(row.stealBelow!).toBeLessThan(row.buyBelow!);
  });

  it("keeps the reported trend null until both windows have enough data", () => {
    const r = computeEstimate({
      specKey: "iphone:16-pro-max|256|good",
      canonicalKey: "iphone:16-pro-max",
      observations: [obs(5000, 1), obs(5100, 2), obs(5200, 3)],
      now: NOW,
    });
    expect(r.trend7Pct).toBeNull();
  });
});
