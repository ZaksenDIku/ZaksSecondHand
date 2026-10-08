import { db } from "./index";
import { flips, listings } from "./schema";
import { eq } from "drizzle-orm";
import { newId } from "./ids";

export interface FlipInput {
  id?: string;
  listingId?: string | null;
  productLabel: string;
  canonicalKey?: string | null;
  storageGb?: number | null;
  purchasePriceDkk: number;
  purchaseDate?: number;
  purchaseMarketplace?: string | null;
  expensesDkk?: number;
  salePriceDkk?: number | null;
  saleDate?: number | null;
  salePlatform?: string | null;
  status?: string;
  offerDkk?: number | null;
  listedForSaleAt?: number | null;
  notes?: string;
  origin?: string;
}

export function createFlip(input: FlipInput): string {
  const listing = input.listingId ? db.select().from(listings).where(eq(listings.id, input.listingId)).get() : null;
  const id = input.id ?? newId("flip");
  db.insert(flips)
    .values({
      id,
      listingId: input.listingId ?? null,
      productLabel: input.productLabel,
      canonicalKey: input.canonicalKey ?? listing?.canonicalKey ?? null,
      storageGb: input.storageGb ?? listing?.storageGb ?? null,
      purchasePriceDkk: input.purchasePriceDkk,
      purchaseDate: input.purchaseDate ?? Date.now(),
      purchaseMarketplace: input.purchaseMarketplace ?? listing?.marketplaceKey ?? null,
      expensesDkk: input.expensesDkk ?? 0,
      salePriceDkk: input.salePriceDkk ?? null,
      saleDate: input.saleDate ?? null,
      salePlatform: input.salePlatform ?? null,
      status: input.status ?? "CONTACTED",
      offerDkk: input.offerDkk ?? null,
      notes: input.notes ?? "",
      origin: input.origin ?? "IMPORTED",
      createdAt: Date.now(),
    })
    .run();
  return id;
}

export function updateFlip(id: string, input: Partial<FlipInput>): boolean {
  const existing = db.select().from(flips).where(eq(flips.id, id)).get();
  if (!existing) return false;
  const next: Partial<typeof flips.$inferInsert> = {};
  if (input.productLabel !== undefined) next.productLabel = input.productLabel;
  if (input.canonicalKey !== undefined) next.canonicalKey = input.canonicalKey;
  if (input.storageGb !== undefined) next.storageGb = input.storageGb;
  if (input.purchasePriceDkk !== undefined) next.purchasePriceDkk = input.purchasePriceDkk;
  if (input.purchaseDate !== undefined) next.purchaseDate = input.purchaseDate;
  if (input.purchaseMarketplace !== undefined) next.purchaseMarketplace = input.purchaseMarketplace;
  if (input.expensesDkk !== undefined) next.expensesDkk = input.expensesDkk;
  if (input.salePriceDkk !== undefined) next.salePriceDkk = input.salePriceDkk;
  if (input.saleDate !== undefined) next.saleDate = input.saleDate;
  if (input.salePlatform !== undefined) next.salePlatform = input.salePlatform;
  if (input.status !== undefined) next.status = input.status;
  if (input.offerDkk !== undefined) next.offerDkk = input.offerDkk;
  if (input.listedForSaleAt !== undefined) next.listedForSaleAt = input.listedForSaleAt;
  if (input.notes !== undefined) next.notes = input.notes;
  db.update(flips).set(next).where(eq(flips.id, id)).run();
  return true;
}

export function deleteFlip(id: string): boolean {
  const existing = db.select({ id: flips.id }).from(flips).where(eq(flips.id, id)).get();
  if (!existing) return false;
  db.delete(flips).where(eq(flips.id, id)).run();
  return true;
}
