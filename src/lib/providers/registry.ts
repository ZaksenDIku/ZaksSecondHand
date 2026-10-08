import { db } from "../db/index";
import { listings, marketplaces } from "../db/schema";
import {eq} from "drizzle-orm";
import type { MarketplaceProvider, ProviderStatus, SyncResult } from "./types";
import { dbaProvider } from "./dba";
import { facebookProvider } from "./facebook";
import { vintedProvider } from "./vinted";
import { manualProvider } from "./manual";
import { demoProvider } from "../db/demo-provider";
import { emailIngestProvider } from "./email-ingest";

export const providers: MarketplaceProvider[] = [
  dbaProvider,
  facebookProvider,
  vintedProvider,
  manualProvider,
  emailIngestProvider,
  demoProvider,
];

export const providerMap = new Map(providers.map((p) => [p.key, p]));

export function getProvider(key: string): MarketplaceProvider | null {
  return providerMap.get(key) ?? null;
}

export function listingCountFor(key: string): number {
  const row = db
    .select({ n: listings.id })
    .from(listings)
    .where(eq(listings.marketplaceKey, key))
    .all();
  return row.length;
}

export async function getAllStatuses(): Promise<ProviderStatus[]> {
  const states = db.select().from(marketplaces).all();
  const byKey = new Map(states.map((s) => [s.key, s]));
  const statuses = await Promise.all(providers.map((p) => p.getStatus()));
  return statuses.map((s) => {
    const row = byKey.get(s.key);
    return {
      ...s,
      lastSyncAt: row?.lastSyncAt ?? s.lastSyncAt,
      lastSyncError: row?.lastSyncError ?? s.lastSyncError,
      listingCount: listingCountFor(s.key),
    };
  });
}

export async function syncProvider(key: string): Promise<SyncResult> {
  const provider = providerMap.get(key);
  if (!provider?.sync) {
    return { fetched: 0, created: 0, updated: 0, skipped: 0, error: "Provider har ikke en synkroniseringssti" };
  }
  try {
    const result = await provider.sync();
    db.update(marketplaces)
      .set({ lastSyncAt: Date.now(), lastSyncError: result.error ?? null })
      .where(eq(marketplaces.key, key))
      .run();
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.update(marketplaces)
      .set({ lastSyncAt: Date.now(), lastSyncError: message })
      .where(eq(marketplaces.key, key))
      .run();
    return { fetched: 0, created: 0, updated: 0, skipped: 0, error: message };
  }
}

export function nonDemoProviders() {
  return providers.filter((p) => p.key !== "demo");
}

export function hasLiveProvider(): boolean {
  return providers.some((p) => p.key !== "demo");
}
