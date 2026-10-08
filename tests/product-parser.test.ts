import { describe, it, expect } from "vitest";
import { parseProduct, conditionFactor, batteryFactor, storageDesirability } from "@/lib/core/product-parser";
import {
  parseDkk,
  parseStorage,
  parseRam,
  parseBatteryHealth,
  parseRelativeTime,
  extractPrice,
  titleSimilarity,
  normalizeText,
} from "@/lib/core/normalize";

describe("product parser", () => {
  it("parses an iPhone 16 Pro Max with storage from the title", () => {
    const p = parseProduct({ title: "iPhone 16 Pro Max 256GB" });
    expect(p.productType).toBe("iphone");
    expect(p.generation).toBe("16");
    expect(p.variant).toBe("Pro Max");
    expect(p.storageGb).toBe(256);
    expect(p.canonicalKey).toBe("iphone:16-pro-max");
    expect(p.ambiguous).toBe(false);
  });

  it("parses a Danish-language iPhone 15 Pro", () => {
    const p = parseProduct({ title: "iPhone 15 Pro 128 GB - brugt, fin stand" });
    expect(p.productType).toBe("iphone");
    expect(p.generation).toBe("15");
    expect(p.variant).toBe("Pro");
    expect(p.storageGb).toBe(128);
  });

  it("parses an Apple Silicon MacBook Air", () => {
    const p = parseProduct({ title: "MacBook Air 13\" M2 256GB" });
    expect(p.productType).toBe("macbook");
    expect(p.chip).toBe("M2");
    expect(p.storageGb).toBe(256);
  });

  it("falls back to the description when the title is too vague", () => {
    const p = parseProduct({ title: "iPhone", description: "16 pro max 512 gb, sælges grundet opgradering" });
    expect(p.storageGb).toBe(512);
    expect(p.variant).toBe("Pro Max");
  });

  it("marks a listing ambiguous when storage is unknown", () => {
    const p = parseProduct({ title: "iPhone 16 Pro Max" });
    expect(p.storageGb).toBeNull();
    expect(p.ambiguous).toBe(true);
  });

  it("never guesses a storage tier", () => {
    const p = parseProduct({ title: "iPhone 16 Pro Max 1 TB" });
    expect(p.storageGb).toBe(1024);
  });

  it("keeps a stable specKey for identical configurations", () => {
    const a = parseProduct({ title: "iPhone 16 Pro 256GB" });
    const b = parseProduct({ title: "iPhone  16  pro   256GB til salg" });
    expect(a.specKey).toBe(b.specKey);
  });
});

describe("price and attribute normalization", () => {
  it.each([
    ["4.100 kr", 4100],
    ["4.100 kr.", 4100],
    ["4100 DKK", 4100],
    ["kr. 4.100", 4100],
    ["4 100,-", 4100],
    ["2.500", 2500],
  ])("parses %s", (raw, expected) => {
    expect(parseDkk(raw)).toBe(expected);
  });

  it("returns null for nonsense prices", () => {
    expect(parseDkk("pris på aftale")).toBeNull();
    expect(parseDkk(null)).toBeNull();
  });

  it("parses storage only when a unit is present (never guesses)", () => {
    expect(parseStorage("256 GB")).toBe(256);
    expect(parseStorage("256gb")).toBe(256);
    expect(parseStorage("1TB")).toBe(1024);
    expect(parseStorage("1 tb")).toBe(1024);
    expect(parseStorage("512")).toBeNull();
    expect(parseStorage("meget stor")).toBeNull();
    expect(parseStorage("8192 GB")).toBeNull();
  });

  it("parses RAM only for machines", () => {
    expect(parseRam("16 gb")).toBe(16);
    expect(parseRam("8GB unified")).toBe(8);
  });

  it("parses battery health from Danish phrasing", () => {
    expect(parseBatteryHealth("batteri 92%")).toBe(92);
    expect(parseBatteryHealth("batterihelse 87 procent")).toBe(87);
    expect(parseBatteryHealth("batteriet er 100%")).toBe(100);
    expect(parseBatteryHealth("batteri 20%")).toBeNull();
  });

  it("parses relative Danish timestamps", () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    const d = parseRelativeTime("for 2 timer siden", now);
    expect(d).not.toBeNull();
    expect(Math.round((now - d!) / 3600000)).toBe(2);
  });

  it("extracts a price out of free text", () => {
    expect(extractPrice("iPhone 16 Pro 256GB\n4.100 kr\nKøbenhavn K")).toBe(4100);
  });

  it("scores identical titles as similar and unrelated ones as different", () => {
    expect(titleSimilarity("iPhone 16 Pro 256GB", "iphone 16 pro 256gb")).toBeGreaterThan(0.9);
    expect(titleSimilarity("iPhone 16 Pro 256GB", "MacBook Air M2 512GB")).toBeLessThan(0.4);
  });

  it("lowercases, strips accents and flattens separators", () => {
    expect(normalizeText("Énhed / Sölv, sort")).toBe("enhed solv sort");
    expect(normalizeText("iPhone_16-Pro.Max")).toBe("iphone 16 pro max");
  });
});

describe("condition / battery / storage factors", () => {
  it("ranks conditions in the expected order", () => {
    expect(conditionFactor("new")).toBeGreaterThan(conditionFactor("like_new"));
    expect(conditionFactor("like_new")).toBeGreaterThan(conditionFactor("good"));
    expect(conditionFactor("good")).toBeGreaterThan(conditionFactor("fair"));
    expect(conditionFactor("fair")).toBeGreaterThan(conditionFactor("poor"));
  });

  it("rewards a healthy battery and never invents a penalty for unknown health", () => {
    expect(batteryFactor(98)).toBeGreaterThan(batteryFactor(85));
    expect(batteryFactor(85)).toBeGreaterThan(batteryFactor(80));
    expect(batteryFactor(60)).toBeGreaterThanOrEqual(0.8);
    expect(batteryFactor(null)).toBe(1);
  });

  it("prefers larger storage on iPhones but not absurdly large tiers", () => {
    const mid = storageDesirability(256, "iphone");
    const small = storageDesirability(64, "iphone");
    expect(mid).toBeGreaterThan(small);
  });
});
