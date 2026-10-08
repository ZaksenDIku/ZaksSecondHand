import { db } from "./index";
import { listings, listingSnapshots, priceObservations, riskSignals } from "./schema";
import { eq } from "drizzle-orm";
import { ingestBatch } from "./ingest";
import type { RawListingRecord } from "../providers/types";

/**
 * DEVELOPMENT FIXTURES.
 *
 * Everything produced here is tagged origin = "DEMO" and marketplace = "demo".
 * It is never presented as a real listing: the UI badges every row, real
 * market aggregates exclude it unless demo mode is on, and it can be wiped
 * from Settings in one click.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoSpec {
  model: string;
  anchor: number;
  titles: string[];
}

const SPECS: DemoSpec[] = [
  { model: "iPhone 15", anchor: 3300, titles: ["iPhone 15 128 - pæn", "Apple iPhone 15, 128gb", "15 256 iphone"] },
  { model: "iPhone 15 Pro", anchor: 4500, titles: ["iPhone 15 Pro 256gb - perfekt stand", "15 pro 256", "Apple iphone15pro 256"] },
  { model: "iPhone 15 Pro Max", anchor: 5400, titles: ["15promax 256", "iPhone 15 Pro Max 256 gb", "IPHONE 15 PROMAX 512"] },
  { model: "iPhone 16", anchor: 4400, titles: ["iPhone 16 128 - med kvittering", "iphone 16 256", "Apple iPhone16"] },
  { model: "iPhone 16 Plus", anchor: 4700, titles: ["iPhone 16 Plus 256gb", "16 plus 128"] },
  { model: "iPhone 16 Pro", anchor: 5700, titles: ["iPhone 16 Pro 256 GB", "16promax pro 256", "Apple iPhone 16 Pro 128gb"] },
  { model: "iPhone 16 Pro Max", anchor: 6500, titles: ["iPhone 16 Pro Max 256", "16 pro max 512 gb"] },
  { model: "iPhone 16e", anchor: 3100, titles: ["iPhone 16e 128", "16e - næsten ny"] },
  { model: "iPhone 17", anchor: 5700, titles: ["iPhone 17 256gb", "Apple iPhone 17 - sælges"] },
  { model: "iPhone 17 Pro", anchor: 7500, titles: ["iPhone 17 Pro 256", "17 pro 512 gb"] },
  { model: "iPhone 17 Pro Max", anchor: 8300, titles: ["iPhone 17 Pro Max 256 gb"] },
  { model: "MacBook Air M1", anchor: 3900, titles: ["Macbook air m1 16/512", "MacBook Air M1 - 8/256"] },
  { model: "MacBook Air M2", anchor: 5000, titles: ["Macbook air m2 16/512", "MacBook Air M2 8/256", "MBA M2 16gb"] },
  { model: "MacBook Air M3", anchor: 5900, titles: ["Macbook air m3 8/256", "MacBook Air 13 M3 16/512"] },
  { model: "MacBook Air M4", anchor: 6700, titles: ["MacBook Air M4 16/512", "macbook air m4 13\"]"] },
  { model: "MacBook Pro M1 Pro", anchor: 6400, titles: ["MBP M1 Pro 14 16/512", "Macbook pro m1 pro 16/1tb"] },
  { model: "MacBook Pro M2 Pro", anchor: 7600, titles: ["Macbook pro 14 m2 pro 16/512", "MBP M2 Pro 16gb/1tb"] },
  { model: "MacBook Pro M3 Pro", anchor: 9200, titles: ["Macbook pro 14 m3 pro 18/512", "MacBook Pro M3 Pro 16/1024"] },
  { model: "MacBook Pro M4 Pro", anchor: 13000, titles: ["MacBook Pro M4 Pro 24/1024", "mbp m4 pro 16/512"] },
];

const LOCATIONS = [
  "København", "Frederiksberg", "Valby", "Taastrup", "Roskilde", "Næstved", "Hillerød",
  "Helsingør", "Aarhus", "Aalborg", "Odense", "Kolding", "Esbjerg", "Randers", "Vejle",
  "Lyngby", "Vanløse", "Amager", "Greve", "Birkerød",
];

const CONDITIONS = ["God stand", "Som ny", "Brugt", "Pæn og velholdt", "Ny i æske"];

const RISKY = [
  "kan ikke testes da den er låst",
  "glemt adgangskode",
  "iCloud låst - sælger kan ikke fjerne den",
  "reservedel / defekt skærm",
  "kun MobilePay depositum før afhentning",
  "ingen kvittering",
  "MDM fra tidligere firma",
];

const CLEAN = [
  "Kvittering haves. Købt hos Apple.",
  "Altid brugt med cover og skærmbeskytter.",
  "Batteri kontrolleret løbende.",
  "Sender gerne på MobilePay.",
  "Kan afhentes i dag.",
];

function imageFor(productType: string, i: number): string | null {
  if (i % 7 === 3) return null;
  return productType === "macbook" ? "/demo/macbook.svg" : "/demo/iphone.svg";
}

export function buildDemoRecords(count = 58): RawListingRecord[] {
  const rnd = mulberry32(20260928);
  const now = Date.now();
  const records: RawListingRecord[] = [];

  for (let i = 0; i < count; i++) {
    const spec = SPECS[Math.floor(rnd() * SPECS.length)];
    const isMac = spec.model.toLowerCase().includes("macbook");
    const title = spec.titles[Math.floor(rnd() * spec.titles.length)];
    const spread = 0.74 + rnd() * 0.46;
    const price = Math.round((spec.anchor * spread) / 50) * 50;
    const recent = rnd() < 0.22;
    const postedAt = recent
      ? now - Math.floor(rnd() * 42 + 2) * 60000
      : now - Math.floor(rnd() * 70 + 1) * 3600000;
    const risky = rnd() < 0.16;
    const condition = CONDITIONS[Math.floor(rnd() * CONDITIONS.length)];
    const battery = isMac ? null : Math.floor(78 + rnd() * 22);
    const location = LOCATIONS[Math.floor(rnd() * LOCATIONS.length)];
    const seller = `demo_sælger_${Math.floor(rnd() * 40) + 1}`;

    const description = [
      `${condition}.`,
      isMac
        ? "Maskinen kører perfekt. Leveres med lader."
        : `Batteri ${battery}%. Alt virker som det skal.`,
      risky ? RISKY[Math.floor(rnd() * RISKY.length)] : CLEAN[Math.floor(rnd() * CLEAN.length)],
      `Afhentes i ${location}.`,
    ].join(" ");

    records.push({
      externalId: `demo-${i + 1}`,
      url: null,
      rawTitle: title,
      description,
      priceDkk: price,
      imageUrl: imageFor(isMac ? "macbook" : "iphone", i),
      location,
      postedAt,
      sellerHandle: seller,
      distanceKm: Math.round(rnd() * 90),
      origin: "DEMO",
      explicit: {
        condition: condition === "Ny i æske" ? "new" : condition === "Som ny" ? "like_new" : condition === "God stand" || condition === "Pæn og velholdt" ? "good" : "good",
        batteryHealth: battery,
      },
    });
  }
  return records;
}

export function demoSeeded(): boolean {
  const row = db.select({ id: listings.id }).from(listings).where(eq(listings.origin, "DEMO")).limit(1).get();
  return Boolean(row);
}

export async function seedDemoFixtures(): Promise<void> {
  if (demoSeeded()) return;
  const records = buildDemoRecords();
  await ingestBatch(records, "demo");

  // Simulate a handful of price drops so the history UI has something real to show.
  const dropped = records.filter((_, i) => i % 8 === 2).slice(0, 6);
  await ingestBatch(
    dropped.map((r) => ({ ...r, priceDkk: Math.round((r.priceDkk * 0.92) / 50) * 50 })),
    "demo"
  );
}

export function clearDemoFixtures(): void {
  const ids = db.select({ id: listings.id }).from(listings).where(eq(listings.origin, "DEMO")).all();
  for (const { id } of ids) {
    db.delete(listingSnapshots).where(eq(listingSnapshots.listingId, id)).run();
    db.delete(riskSignals).where(eq(riskSignals.listingId, id)).run();
    db.delete(priceObservations).where(eq(priceObservations.listingId, id)).run();
    db.delete(listings).where(eq(listings.id, id)).run();
  }
}
