import { describe, it, expect } from "vitest";
import { computeVelocity, VELOCITY_META, type VelocityLevel } from "@/lib/core/velocity";
import { smartSummary } from "@/lib/core/smart-summary";
import { hiddenGemScore } from "@/lib/core/hidden-gem";
import { generateOffers, negotiationPoints } from "@/lib/core/negotiation";
import { checklistFor, IPHONE_CHECKLIST, MACBOOK_CHECKLIST } from "@/lib/core/checklists";
import type { VelocityInput } from "@/lib/core/velocity";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const hour = 3600000;

const base: VelocityInput = {
  postedAt: NOW - 2 * hour,
  now: NOW,
  discountPct: 12,
  dealScore: 72,
  sampleCount: 4,
  modelSampleCount: 10,
  priceDkk: 6000,
  marketMedianDkk: 6800,
  productType: "iphone",
  historicalLifetimeHours: null,
};

describe("deal velocity", () => {
  it("rates a fresh, discounted, popular listing as fast-moving", () => {
    const r = computeVelocity({ ...base, postedAt: NOW - 30 * 60000, discountPct: 30, sampleCount: 15 });
    expect(r.score).toBeGreaterThan(65);
    expect(["HIGH", "EXTREME"]).toContain(r.level);
  });

  it("rates a stale, overpriced listing as slow-moving", () => {
    const r = computeVelocity({ ...base, postedAt: NOW - 200 * hour, discountPct: -10, sampleCount: 0, dealScore: 30 });
    expect(r.score).toBeLessThan(45);
    expect(["LOW", "NORMAL"]).toContain(r.level);
  });

  it("ranks a fresh listing above an identical older one", () => {
    const fresh = computeVelocity({ ...base, postedAt: NOW - 10 * 60000 });
    const old = computeVelocity({ ...base, postedAt: NOW - 96 * hour });
    expect(fresh.score).toBeGreaterThan(old.score);
  });

  it("is deterministic and bounded", () => {
    expect(computeVelocity(base)).toEqual(computeVelocity(base));
    const wild = computeVelocity({ ...base, discountPct: 500, dealScore: 999, sampleCount: 9999, postedAt: NOW });
    expect(wild.score).toBeLessThanOrEqual(100);
    expect(wild.score).toBeGreaterThanOrEqual(0);
  });

  it("always returns a Danish explanation and a known level", () => {
    const r = computeVelocity(base);
    expect(r.reason.length).toBeGreaterThan(0);
    expect(VELOCITY_META[r.level as VelocityLevel]).toBeDefined();
    expect(r.emoji).toBeTruthy();
  });

  it("lowers confidence when there is no history to lean on", () => {
    expect(computeVelocity({ ...base, historicalLifetimeHours: null }).confidence).not.toBe("HIGH");
    expect(computeVelocity({ ...base, historicalLifetimeHours: 10 }).confidence).toBe("HIGH");
  });
});

describe("smart summary", () => {
  const input = {
    title: "iPhone 16 Pro Max 256GB",
    priceDkk: 4000,
    marketValueDkk: 5500,
    quickSaleValueDkk: 4800,
    discountPct: 27,
    netProfitDkk: 1100,
    roiPct: 22,
    dealScore: 88,
    riskScore: 10,
    riskLevel: "LOW",
    ageMin: 20,
    batteryHealth: 94,
    estimateSample: 12,
    estimateConfidence: "MEDIUM",
    storageGb: 256,
    productType: "iphone",
    distanceKm: 8,
    origin: "IMPORTED" as const,
    parseConfidence: 95,
    parseAmbiguous: false,
    riskCodes: [],
    snapshotCount: 3,
    priceDrop: 300,
    velocityLabel: "HIGH",
  };

  it("leads with the discount", () => {
    const lines = smartSummary(input);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].text).toMatch(/27 %/);
  });

  it("mentions freshness and profit", () => {
    const text = smartSummary(input).map((l) => l.text).join(" | ");
    expect(text).toMatch(/min|siden/i);
    expect(text).toMatch(/profit|ROI|kr/i);
  });

  it("warns when the asking price is above the market value", () => {
    const lines = smartSummary({ ...input, discountPct: -12, priceDkk: 7000 });
    expect(lines[0].tone).toBe("warn");
  });

  it("says so plainly when there is no market data", () => {
    const lines = smartSummary({ ...input, marketValueDkk: null, discountPct: null, quickSaleValueDkk: null });
    expect(lines[0].text).toMatch(/ingen markedsværdi/i);
  });

  it("surfaces a blocking risk regardless of how good the price is", () => {
    const lines = smartSummary({ ...input, riskCodes: ["ICLOUD_LOCK"], riskLevel: "AVOID", riskScore: 95 });
    expect(lines.map((l) => l.text).join(" ")).toMatch(/l[åa]st|avoid|risiko/i);
  });

  it("flags AI-parsed or ambiguous records so the user can verify", () => {
    const lines = smartSummary({ ...input, parseAmbiguous: true, origin: "IMPORTED" });
    expect(lines.map((l) => l.text).join(" ")).toMatch(/AI PARSED|bekræft specifikationerne/i);
  });

  it("never lists a trust signal as a risk factor", () => {
    const text = smartSummary({ ...input, riskCodes: ["HAS_RECEIPT", "NO_RECEIPT"] })
      .map((l) => l.text)
      .join(" | ");
    expect(text).toMatch(/Risikofaktorer: NO_RECEIPT/);
    expect(text).not.toMatch(/Risikofaktorer:[^|]*HAS_RECEIPT/);
    expect(text).toMatch(/Tryghedssignaler: HAS_RECEIPT/);
  });

  it("shows only a risk line when there is no trust signal", () => {
    const text = smartSummary({ ...input, riskCodes: ["CANNOT_TEST"] })
      .map((l) => l.text)
      .join(" | ");
    expect(text).toMatch(/Risikofaktorer: CANNOT_TEST/);
    expect(text).not.toMatch(/Tryghedssignaler/);
  });

});

describe("hidden gem detection", () => {
  it("scores a vague, under-described listing above a well-described one", () => {
    const vague = hiddenGemScore({
      rawTitle: "iPhone til salg",
      title: "iPhone 16 Pro Max 256GB",
      description: "God stand.",
      parseConfidence: 70,
      parseAmbiguous: false,
      discountPct: 18,
      productType: "iphone",
      storageGb: 256,
      ramGb: null,
      condition: "good",
      batteryHealth: null,
      descriptionLength: 11,
    });
    const detailed = hiddenGemScore({
      rawTitle: "iPhone 16 Pro Max 256GB - ny, ubrugt, med kasse",
      title: "iPhone 16 Pro Max 256GB",
      description: "Købt hos Apple Danmark i marts 2025. Ubrugt, alt medfølger, kvittering vedlagt. Flytter grundet nyt job.",
      parseConfidence: 98,
      parseAmbiguous: false,
      discountPct: 18,
      productType: "iphone",
      storageGb: 256,
      ramGb: null,
      condition: "new",
      batteryHealth: 100,
      descriptionLength: 160,
    });
    expect(vague.score).toBeGreaterThan(detailed.score);
  });

  it("frames the suspicion as a hypothesis, not a fact", () => {
    const r = hiddenGemScore({
      rawTitle: "iPhone",
      title: "iPhone 16 Pro Max 256GB",
      description: "Sælger",
      parseConfidence: 60,
      parseAmbiguous: true,
      discountPct: 30,
      productType: "iphone",
      storageGb: 256,
      ramGb: null,
      condition: "good",
      batteryHealth: null,
      descriptionLength: 6,
    });
    expect(r.hypothesis).toBeTruthy();
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("returns a zero score for a clean, well-described listing", () => {
    const r = hiddenGemScore({
      rawTitle: "iPhone 16 Pro Max 256GB - ny",
      title: "iPhone 16 Pro Max 256GB",
      description: "Ny enhed købt hos Apple med kvittering. Alle dele medfølger i original kasse. Flytter grundet udlandsprojekt.",
      parseConfidence: 99,
      parseAmbiguous: false,
      discountPct: 5,
      productType: "iphone",
      storageGb: 256,
      ramGb: null,
      condition: "new",
      batteryHealth: 100,
      descriptionLength: 180,
    });
    expect(r.score).toBeLessThan(20);
  });

  it("is deterministic", () => {
    const input = {
      rawTitle: "iPhone til salg",
      title: "iPhone 16",
      description: "God stand, pris 3000",
      parseConfidence: 60,
      parseAmbiguous: true,
      discountPct: 20,
      productType: "iphone" as const,
      storageGb: 256,
      ramGb: null,
      condition: "good",
      batteryHealth: null,
      descriptionLength: 25,
    };
    expect(hiddenGemScore(input)).toEqual(hiddenGemScore(input));
  });
});

describe("negotiation", () => {
  const input = {
    modelLabel: "iPhone 16 Pro Max 256GB",
    askingPrice: 5000,
    marketMedian: 6000,
    quickSale: 5200,
    daysListed: 40,
    batteryHealth: 88,
    location: "København K",
  };

  it("always offers less than the asking price", () => {
    for (const o of generateOffers(input)) {
      expect(o.amount).toBeLessThan(input.askingPrice);
      expect(o.message.length).toBeGreaterThan(0);
      expect(o.label.length).toBeGreaterThan(0);
    }
  });

  it("orders offers from conservative to aggressive", () => {
    const offers = generateOffers(input);
    const amounts = offers.map((o) => o.amount);
    expect(amounts[0]).toBeGreaterThanOrEqual(amounts[1]);
    expect(amounts[1]).toBeGreaterThanOrEqual(amounts[2]);
  });

  it("pushes harder on a long-listed item than a fresh one", () => {
    const stale = generateOffers({ ...input, daysListed: 90 })[2].amount;
    const fresh = generateOffers({ ...input, daysListed: 1 })[2].amount;
    expect(stale).toBeLessThan(fresh);
  });

  it("stays sensible when there is no market data", () => {
    const offers = generateOffers({ ...input, marketMedian: null, quickSale: null });
    expect(offers.every((o) => o.amount > 0)).toBe(true);
  });

  it("derives talking points from real attributes", () => {
    const points = negotiationPoints(input).join(" ");
    expect(points.length).toBeGreaterThan(0);
    const lowBattery = negotiationPoints({ ...input, batteryHealth: 71 }).join(" ");
    expect(lowBattery).toMatch(/batteri/i);
  });
});

describe("purchase checklists", () => {
  it("covers the deal-breakers on an iPhone", () => {
    const labels = IPHONE_CHECKLIST.map((c) => c.id);
    expect(labels).toContain("findmy");
    expect(labels).toContain("imei");
    expect(labels).toContain("battery");
  });

  it("covers MDM and battery cycles on a MacBook", () => {
    const labels = MACBOOK_CHECKLIST.map((c) => c.id);
    expect(labels).toContain("mdm");
    expect(labels).toContain("cycles");
    expect(labels).toContain("findmy");
  });

  it("gives every item a human-readable detail", () => {
    for (const item of [...IPHONE_CHECKLIST, ...MACBOOK_CHECKLIST]) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.detail && item.detail.length).toBeGreaterThan(0);
    }
  });

  it("picks the right checklist per product type", () => {
    expect(checklistFor("iphone")).toBe(IPHONE_CHECKLIST);
    expect(checklistFor("macbook")).toBe(MACBOOK_CHECKLIST);
    expect(checklistFor(null).length).toBeGreaterThan(0);
  });
});
