export type ProductType = "iphone" | "macbook" | "ipad" | "watch" | "other";

export type Condition = "new" | "like_new" | "good" | "fair" | "poor" | "unknown";

/**
 * Opportunity priority. Score band first, then adjusted by discount, age,
 * liquidity and profit so a high score on a stale, illiquid listing does not
 * get the same visual urgency as a genuinely fresh steal.
 */
export type DealTier = "NORMAL" | "GOOD" | "GREAT" | "HOT" | "URGENT";

/** Risk is deliberately independent of DealScore: cheap never cancels risk. */
export type RiskLevel = "LOW" | "CHECK" | "ELEVATED" | "HIGH" | "AVOID";

export type DataOrigin = "REAL" | "IMPORTED" | "DEMO" | "STALE";

export type ProviderAccessStatus = "LIVE" | "LIMITED" | "MANUAL" | "UNAVAILABLE";

export interface ParsedProduct {
  brand: string;
  productType: ProductType;
  /** e.g. "16" for iPhone 16, "M2" era marker for mac is in `chip` */
  generation: string | null;
  variant: string | null;
  /** Human model label: "iPhone 16 Pro", "MacBook Air" */
  model: string;
  storageGb: number | null;
  ramGb: number | null;
  chip: string | null;
  screenSize: string | null;
  color: string | null;
  year: number | null;
  condition: Condition;
  batteryHealth: number | null;
  /** Stable grouping key, e.g. "iphone:16-pro" / "macbook-air:m2" */
  canonicalKey: string;
  /** Key including storage + condition, e.g. "iphone:16-pro|256|good" */
  specKey: string;
  confidence: number;
  ambiguous: boolean;
  inScope: boolean;
  matchedTerms: string[];
  unmatchedTokens: string[];
}

export interface MarketEstimateResult {
  specKey: string;
  canonicalKey: string;
  basis: "DIRECT" | "SIBLING_STORAGE" | "CANONICAL" | "NONE";
  sampleCount: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  fairValue: number | null;
  quickSale: number | null;
  trend7Pct: number | null;
  trend30Pct: number | null;
  confidence: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  updatedAt: number;
}

export interface DealScoreWeights {
  discount: number;
  age: number;
  resaleStrength: number;
  liquidity: number;
  storageDesirability: number;
  condition: number;
  battery: number;
  sellerTrust: number;
  completeness: number;
  geography: number;
  demand: number;
  riskPenalty: number;
}

export interface DealScoreInput {
  discountPct: number | null;
  netProfitDkk?: number | null;
  roiPct?: number | null;
  listingAgeMinutes: number;
  marketValue: number | null;
  quickSale: number | null;
  liquidity: number;
  storageDesirability: number;
  condition: Condition;
  batteryHealth: number | null;
  sellerTrust: number;
  completeness: number;
  distanceKm: number | null;
  demandPressure: number;
  riskScore: number;
}

export interface DealScoreResult {
  score: number;
  tier: DealTier;
  components: Record<string, number>;
  weights: DealScoreWeights;
  penalty: number;
}

export interface RiskSignalResult {
  code: string;
  phrase: string | null;
  severity: "high" | "medium" | "low";
  weight: number;
  detail: string;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  /** True when a deal-breaker such as Activation Lock or MDM was detected. */
  blocking: boolean;
  signals: RiskSignalResult[];
}

export interface FlipInput {
  purchasePrice: number;
  platformFeePct: number;
  transportDkk: number;
  repairAllowanceDkk: number;
  negotiationAdjustmentDkk: number;
  expectedResale: number;
}

export interface FlipResult {
  totalCost: number;
  grossProfit: number;
  netProfit: number;
  roiPct: number;
}

export interface ListingFilters {
  marketplaces?: string[];
  productTypes?: string[];
  generations?: string[];
  models?: string[];
  storageGb?: number[];
  ramGb?: number[];
  chips?: string[];
  minPrice?: number;
  maxPrice?: number;
  minDealScore?: number;
  minProfit?: number;
  minRoi?: number;
  maxAgeMinutes?: number;
  conditions?: string[];
  minBattery?: number;
  riskLevels?: string[];
  origins?: string[];
  tiers?: string[];
  statuses?: string[];
  includeIgnored?: boolean;
  includeDuplicates?: boolean;
  productType?: string;
  q?: string;
  sort?: SortKey;
  limit?: number;
}

export type SortKey =
  | "newest"
  | "score"
  | "profit"
  | "discount"
  | "price_asc"
  | "roi";
