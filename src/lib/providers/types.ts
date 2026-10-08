import type { DataOrigin, ProviderAccessStatus } from "../core/types";

/**
 * A raw record as supplied by a provider or an import, before normalisation.
 * Nothing reaches the database until it has been through the same pipeline:
 * parse -> estimate -> score -> risk -> duplicate check.
 */
export interface RawListingRecord {
  /** Marketplace attribution from the import itself, when known up front. */
  marketplaceKey?: string | null;
  externalId?: string | null;
  url?: string | null;
  rawTitle: string;
  description?: string | null;
  priceDkk: number;
  imageUrl?: string | null;
  location?: string | null;
  postedAt?: number | null;
  sellerHandle?: string | null;
  sellerMeta?: Record<string, unknown> | null;
  distanceKm?: number | null;
  origin: DataOrigin;
  /** Optional authoritative fields that skip the fuzzy parser. */
  explicit?: Record<string, string | number | null>;
}

export interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
}

export interface ProviderStatus {
  key: string;
  name: string;
  accessStatus: ProviderAccessStatus;
  accessMode: string;
  detail: string;
  requirements: string[];
  enabled: boolean;
  canSync: boolean;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  listingCount: number;
  docsUrl?: string;
}

export interface SearchQuery {
  text?: string;
  limit?: number;
}

export interface MarketplaceProvider {
  key: string;
  name: string;
  getStatus(): Promise<ProviderStatus>;
  /** Only implemented when the provider has a permitted programmatic path. */
  search?(query: SearchQuery): Promise<RawListingRecord[]>;
  /** Fetch one listing, typically from a user-supplied URL. */
  fetchListing?(url: string): Promise<RawListingRecord | null>;
  /** Periodic sync, only for LIVE providers. */
  sync?(): Promise<SyncResult>;
}
