import { describe, it, expect } from "vitest";
import { detectRisk, levelFor, normalizeUrlKey, compareForDuplicate } from "@/lib/core/risk-score";
import { computeFlip, resaleTarget, flipProfit, flipRoi, daysHeld, FLIP_STATUSES } from "@/lib/core/flip";

const NOW = Date.UTC(2026, 0, 15);
const day = 86400000;

describe("risk score", () => {
  it("gives a complete, trusted listing a low risk level", () => {
    const r = detectRisk({
      title: "iPhone 16 Pro Max 256GB",
      description: "Helt ny, ubrugt, med kasse og kvittering. Flytter grundet arbejde.",
      priceDkk: 6500,
      marketValue: 6500,
      hasImage: true,
      hasLocation: true,
      hasStorage: true,
      hasCondition: true,
      sellerTrusted: true,
      parsedModel: "iPhone 16 Pro Max",
      titleMentionsModel: true,
    });
    expect(r.score).toBeLessThan(40);
    expect(["LOW", "CHECK"]).toContain(r.level);
  });

  it("flags a thin, unverified listing as elevated or worse", () => {
    const r = detectRisk({
      title: "iPhone 16 Pro Max",
      description: "Kan ikke demonstrere enheden. Muligvis låst.",
      priceDkk: 1200,
      hasImage: false,
      hasLocation: false,
      sellerTrusted: false,
      parsedModel: "iPhone 16 Pro Max",
    });
    expect(r.signals.length).toBeGreaterThan(0);
    expect(["CHECK", "ELEVATED", "HIGH", "AVOID"]).toContain(r.level);
  });

  it("raises the score when risk markers accumulate", () => {
    const clean = detectRisk({
      title: "iPhone 16 Pro Max 256GB",
      description: "Ny, ubrugt, kvittering medfølger.",
      priceDkk: 6500,
      marketValue: 6500,
      hasImage: true,
      hasLocation: true,
      hasStorage: true,
      hasCondition: true,
      sellerTrusted: true,
      parsedModel: "iPhone 16 Pro Max",
      titleMentionsModel: true,
    });
    const dirty = detectRisk({
      title: "iPhone 16 Pro Max",
      description: "Kan ikke testes. Uden lader. Sælger er ikke kendt.",
      priceDkk: 1200,
      hasImage: false,
      hasLocation: false,
      sellerTrusted: false,
      parsedModel: "iPhone 16 Pro Max",
    });
    expect(dirty.score).toBeGreaterThan(clean.score);
  });

  it("never invents risk when nothing is known", () => {
    const r = detectRisk({ title: "iPhone", description: "" });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("treats an explicitly disabled Find My as a trust signal, not a blocker", () => {
    const r = detectRisk({ title: "iPhone 16 Pro Max", description: "Find My er slået fra.", hasImage: true });
    expect(r.blocking).toBe(false);
    expect(r.level).toBe("LOW");
  });

  it("marks a still-active Find My as blocking AVOID", () => {
    const r = detectRisk({ title: "iPhone 16 Pro Max", description: "Find My er stadig aktiv.", hasImage: true });
    expect(r.blocking).toBe(true);
    expect(r.level).toBe("AVOID");
  });

  it("marks MDM, unknown IMEI and deposit-only listings as blocking", () => {
    for (const description of [
      "Virksomheds-MDM, remote management aktiv.",
      "Ukendt IMEI, stjålet imei ifølge tjek.",
      "Send penge via mobilepay depositum inden fremvisning.",
    ]) {
      const r = detectRisk({ title: "iPhone 16 Pro", description, hasImage: true });
      expect(r.blocking, description).toBe(true);
      expect(r.level, description).toBe("AVOID");
    }
  });

  it("is deterministic and always bounded", () => {
    const input = { title: "iPhone 16 Pro", description: "batteri 80%", priceDkk: 4000, marketValue: 5000 };
    expect(detectRisk(input)).toEqual(detectRisk(input));
    expect(detectRisk({ title: "", description: "x".repeat(2000) }).score).toBeLessThanOrEqual(100);
  });

  it("escalates a blocking signal to AVOID", () => {
    expect(levelFor(10, true)).toBe("AVOID");
    expect(levelFor(0, false)).toBe("LOW");
  });
});

describe("duplicate detection", () => {
  it("matches the same canonical URL regardless of query noise", () => {
    expect(normalizeUrlKey("https://www.dba.dk/iphone-16-12345?utm_source=x")).toBe(
      normalizeUrlKey("https://www.dba.dk/iphone-16-12345")
    );
    expect(normalizeUrlKey(null)).toBeNull();
  });

  it("flags the same URL on two records as a duplicate", () => {
    const m = compareForDuplicate(
      { id: "a", url: "https://www.dba.dk/x-1", title: "iPhone 16 Pro", priceDkk: 5000, marketplaceKey: "dba" },
      { id: "b", url: "https://www.dba.dk/x-1", title: "iPhone 16 Pro", priceDkk: 5000, marketplaceKey: "dba" }
    );
    expect(m).not.toBeNull();
    expect(m!.confidence).toBeGreaterThan(0.8);
  });

  it("does not merge clearly different products", () => {
    const m = compareForDuplicate(
      { id: "a", url: "https://www.dba.dk/x-1", title: "iPhone 16 Pro", priceDkk: 5000, marketplaceKey: "dba", canonicalKey: "iphone:16-pro" },
      { id: "c", url: null, title: "MacBook Air M2 512GB", priceDkk: 6000, marketplaceKey: "dba", canonicalKey: "macbook-air:m2" }
    );
    expect(m === null || m.isDuplicate === false).toBe(true);
  });
});

describe("flip economics", () => {
  it("nets every cost out of the resale value", () => {
    const r = computeFlip({
      purchasePrice: 5000,
      platformFeePct: 5,
      transportDkk: 200,
      repairAllowanceDkk: 300,
      negotiationAdjustmentDkk: 0,
      expectedResale: 6500,
    });
    // 5000 + 250 fee + 200 transport + 300 repair = 5750 total cost
    expect(r.totalCost).toBe(5750);
    expect(r.grossProfit).toBe(1500);
    expect(r.netProfit).toBe(750);
    expect(r.roiPct).toBeCloseTo(13, 0);
  });

  it("reports a loss as a loss", () => {
    const r = computeFlip({
      purchasePrice: 5000,
      platformFeePct: 5,
      transportDkk: 0,
      repairAllowanceDkk: 0,
      negotiationAdjustmentDkk: 0,
      expectedResale: 4000,
    });
    expect(r.netProfit).toBeLessThan(0);
    expect(r.roiPct).toBeLessThan(0);
  });

  it("adds a negotiated reduction to the cost basis", () => {
    const base = computeFlip({ purchasePrice: 5000, platformFeePct: 0, transportDkk: 0, repairAllowanceDkk: 0, negotiationAdjustmentDkk: 0, expectedResale: 6000 });
    const better = computeFlip({ purchasePrice: 5000, platformFeePct: 0, transportDkk: 0, repairAllowanceDkk: 0, negotiationAdjustmentDkk: 500, expectedResale: 6000 });
    expect(better.netProfit).toBeGreaterThan(base.netProfit);
  });

  it("never divides by zero cost", () => {
    const r = computeFlip({ purchasePrice: 0, platformFeePct: 0, transportDkk: 0, repairAllowanceDkk: 0, negotiationAdjustmentDkk: 0, expectedResale: 1000 });
    expect(Number.isFinite(r.roiPct)).toBe(true);
  });

  it("picks a resale target between quick sale and fair value", () => {
    const t = resaleTarget(6000, 5000);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThanOrEqual(5000);
    expect(t!).toBeLessThanOrEqual(6000);
    expect(resaleTarget(null, null)).toBeNull();
  });

  it("computes profit, roi and holding time for a record", () => {
    const rec = { purchasePriceDkk: 5000, expensesDkk: 400, salePriceDkk: 6200 };
    expect(flipProfit(rec)).toBe(800);
    expect(flipRoi(rec)!).toBeCloseTo(14.8, 1);
    expect(daysHeld(NOW, NOW + 12 * day)).toBe(12);
  });

  it("keeps an open flip's profit unknown rather than zero", () => {
    const open = { purchasePriceDkk: 5000, expensesDkk: 0, salePriceDkk: null };
    expect(flipProfit(open)).toBeNull();
    expect(flipRoi(open)).toBeNull();
  });

  it("exposes a full lifecycle of statuses", () => {
    expect(FLIP_STATUSES).toContain("PURCHASED");
    expect(FLIP_STATUSES).toContain("SOLD");
  });
});

describe("diacritic-insensitive risk phrases", () => {
  const base = {
    title: "iPhone 16 Pro Max",
    description: "Fin enhed.",
    hasImage: true,
    hasStorage: true,
    hasCondition: true,
  };

  it("treats \u201cl\u00e6st\u201d and \u201claest\u201d as the same generic lock", () => {
    const withAe = detectRisk({ ...base, description: "L\u00e6st enhed, kan ikke komme ind" });
    const withAscii = detectRisk({ ...base, description: "Laest enhed, kan ikke komme ind" });
    expect(withAe.signals.map((s) => s.code)).toContain("LOCK_GENERIC");
    expect(withAscii.signals.map((s) => s.code)).toContain("LOCK_GENERIC");
    expect(withAe.score).toBe(withAscii.score);
  });

  it("requires carrier phrasing before reporting SIM_LOCK", () => {
    const generic = detectRisk({ ...base, description: "Laest enhed" });
    expect(generic.signals.map((s) => s.code)).not.toContain("SIM_LOCK");

    const carrier = detectRisk({ ...base, description: "SIM-l\u00e5st til TDC" });
    expect(carrier.signals.map((s) => s.code)).toContain("SIM_LOCK");
  });

  it("escalates a lock bound to another Apple account", () => {
    const r = detectRisk({ ...base, description: "Laest til en anden Apple-konto" });
    expect(r.signals.map((s) => s.code)).toContain("ICLOUD_LOCK");
    expect(r.level).toBe("AVOID");
  });

  it("reads a screen fault written without diacritics", () => {
    const r = detectRisk({ ...base, description: "Skaermen har dode pixels" });
    expect(r.signals.map((s) => s.code)).toContain("SCREEN_ISSUE");
  });
});
