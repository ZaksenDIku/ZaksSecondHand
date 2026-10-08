import type { DataOrigin } from "./core/types";

export interface ListingView {
  id: string;
  marketplaceKey: string;
  externalId: string | null;
  url: string | null;
  title: string;
  rawTitle: string;
  description: string;
  priceDkk: number;
  imageUrl: string | null;
  location: string | null;
  postedAt: number | null;
  firstSeenAt: number;
  lastSeenAt: number;
  origin: DataOrigin;
  productType: string | null;
  model: string;
  generation: string | null;
  variant: string | null;
  storageGb: number | null;
  ramGb: number | null;
  chip: string | null;
  screenSize: string | null;
  color: string | null;
  condition: string | null;
  batteryHealth: number | null;
  parseConfidence: number;
  parseAmbiguous: boolean;
  canonicalKey: string | null;
  specKey: string | null;
  marketValueDkk: number | null;
  quickSaleValueDkk: number | null;
  estimateSample: number;
  estimateConfidence: string;
  discountPct: number | null;
  grossProfitDkk: number | null;
  netProfitDkk: number | null;
  roiPct: number | null;
  totalCostDkk: number | null;
  dealScore: number;
  dealTier: string;
  riskScore: number;
  riskLevel: string;
  scoreFactors: string | null;
  duplicateOf: string | null;
  duplicateConfidence: number | null;
  sellerHandle: string | null;
  distanceKm: number | null;
  status: string;
  watchlisted: boolean;
  ignored: boolean;
  contactedAt: number | null;
  purchasedAt: number | null;
  priceChangedFrom: number | null;
  snapshotCount: number;
  notes: string;
  ageMin: number;
  justListed: boolean;
  signalCount: number;
  priceDrop: number | null;
  inScope: boolean;
  velocityLevel: string;
  velocityScore: number;
  hiddenGemScore: number;
  aiParsed: boolean;
}

export interface DashboardKpis {
  hotDeals: number;
  lastHour: number;
  availableProfit: number;
  iphoneOpps: number;
  macbookOpps: number;
  medianAgeMin: number;
  avgScore: number;
  totalActive: number;
  duplicatesHidden: number;
  demoActive: boolean;
  realCount: number;
  importedCount: number;
  demoCount: number;
  staleCount: number;
}

export interface HeatmapEntry {
  specKey: string;
  canonicalKey: string;
  label: string;
  storageGb: number | null;
  sampleCount: number;
  median: number | null;
  buyBelow: number | null;
  stealBelow: number | null;
  p25: number | null;
  p75: number | null;
  trend30Pct: number | null;
  trend7Pct: number | null;
  confidence: string;
  productType: string | null;
  cheapest: number | null;
}

export interface WatchRow {
  id: string;
  label: string;
  canonicalKey: string | null;
  storageGb: number | null;
  maxPriceDkk: number | null;
  minDealScore: number | null;
  minProfitDkk: number | null;
  productType: string | null;
  enabled: boolean;
  createdAt: number;
  lastMatchAt: number | null;
  currentCheapest: number | null;
  marketMedian: number | null;
  difference: number | null;
  matchingCount: number;
  matchingListings: Array<{ id: string; title: string; priceDkk: number; dealScore: number; marketplaceKey: string; origin: DataOrigin; riskLevel: string; velocityLevel: string }>;
}

export interface FlipView {
  origin: string;
  status: string;
  offerDkk: number | null;
  listedForSaleAt: number | null;
  id: string;
  listingId: string | null;
  canonicalKey: string | null;
  productLabel: string;
  purchasePriceDkk: number;
  purchaseDate: number;
  purchaseMarketplace: string | null;
  expensesDkk: number;
  salePriceDkk: number | null;
  saleDate: number | null;
  salePlatform: string | null;
  notes: string;
  profit: number | null;
  roi: number | null;
  daysHeld: number;
}

export interface AnalyticsSummary {
  totalInvested: number;
  revenue: number;
  profit: number;
  avgProfit: number;
  avgRoi: number;
  bestModel: string | null;
  avgHoldingDays: number;
  closedCount: number;
  openCount: number;
  winRate: number;
  byDay: Array<{ day: string; profit: number; count: number }>;
  byModel: Array<{ model: string; profit: number; count: number; avgRoi: number }>;
}

export interface ListingDetail {
  listing: ListingView;
  snapshots: Array<{ id: string; priceDkk: number; observedAt: number; title: string | null }>;
  signals: Array<{ code: string; detail: string; severity: string; weight: number; phrase: string | null }>;
  comparables: ListingView[];
  factors: {
    components?: Record<string, number>;
    weights?: Record<string, number>;
    penalty?: number;
    estimateBasis?: string;
    trend7Pct?: number | null;
    trend30Pct?: number | null;
  };
  originBreakdown: Array<{ origin: string; count: number }>;
}
