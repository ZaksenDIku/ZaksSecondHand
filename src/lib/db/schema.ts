import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const ts = (name: string) => integer(name, { mode: "number" });
const json = (name: string) => text(name);

/**
 * Data provenance. Every row that leaves the database carries one of these.
 * REAL     - fetched from a live, permitted provider connection
 * IMPORTED - supplied by the user (URL paste, CSV/JSON, email alert)
 * DEMO     - development fixture, never mixed into REAL aggregates without a label
 * STALE    - previously REAL/IMPORTED but not refreshed inside the freshness window
 */
export type DataOrigin = "REAL" | "IMPORTED" | "DEMO" | "STALE";

export const marketplaces = sqliteTable("marketplaces", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  /** LIVE | LIMITED | MANUAL | UNAVAILABLE */
  accessStatus: text("access_status").notNull(),
  /** LIVE_API | FEED | ALERT_INGESTION | MANUAL_IMPORT | URL_IMPORT | UNAVAILABLE */
  accessMode: text("access_mode").notNull(),
  docsUrl: text("docs_url"),
  notes: text("notes").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSyncAt: ts("last_sync_at"),
  lastSyncError: text("last_sync_error"),
});

export const listings = sqliteTable(
  "listings",
  {
    id: text("id").primaryKey(),
    marketplaceKey: text("marketplace_key").notNull(),
    externalId: text("external_id"),
    url: text("url"),
    title: text("title").notNull(),
    rawTitle: text("raw_title").notNull(),
    description: text("description").notNull().default(""),
    priceDkk: integer("price_dkk").notNull(),
    originalPrice: integer("original_price"),
    imageUrl: text("image_url"),
    location: text("location"),
    postedAt: ts("posted_at"),
    firstSeenAt: ts("first_seen_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull(),
    origin: text("origin").notNull().default("IMPORTED"),
    /** Provider status at the moment the row was written. */
    providerStatus: text("provider_status").notNull().default("MANUAL"),

    productType: text("product_type"),
    brand: text("brand"),
    model: text("model"),
    generation: text("generation"),
    variant: text("variant"),
    storageGb: integer("storage_gb"),
    ramGb: integer("ram_gb"),
    chip: text("chip"),
    screenSize: text("screen_size"),
    color: text("color"),
    year: integer("year"),
    condition: text("condition"),
    batteryHealth: integer("battery_health"),
    parseConfidence: real("parse_confidence").notNull().default(0),
    parseAmbiguous: integer("parse_ambiguous", { mode: "boolean" }).notNull().default(false),
    canonicalKey: text("canonical_key"),
    specKey: text("spec_key"),

    marketValueDkk: integer("market_value_dkk"),
    quickSaleValueDkk: integer("quick_sale_value_dkk"),
    estimateSample: integer("estimate_sample").notNull().default(0),
    estimateConfidence: text("estimate_confidence").notNull().default("NONE"),

    discountPct: real("discount_pct"),
    grossProfitDkk: integer("gross_profit_dkk"),
    netProfitDkk: integer("net_profit_dkk"),
    roiPct: real("roi_pct"),
    totalCostDkk: integer("total_cost_dkk"),
    dealScore: real("deal_score").notNull().default(0),
    dealTier: text("deal_tier").notNull().default("FAIR"),
    riskScore: real("risk_score").notNull().default(0),
    riskLevel: text("risk_level").notNull().default("LOW"),
    scoreFactors: json("score_factors"),

    duplicateOf: text("duplicate_of"),
    duplicateConfidence: real("duplicate_confidence"),
    fingerprint: text("fingerprint"),

    sellerHandle: text("seller_handle"),
    sellerMeta: json("seller_meta"),
    distanceKm: real("distance_km"),

    status: text("status").notNull().default("active"),
    watchlisted: integer("watchlisted", { mode: "boolean" }).notNull().default(false),
    ignored: integer("ignored", { mode: "boolean" }).notNull().default(false),
    contactedAt: ts("contacted_at"),
    purchasedAt: ts("purchased_at"),
    priceChangedFrom: integer("price_changed_from"),
    snapshotCount: integer("snapshot_count").notNull().default(1),
    notes: text("notes").notNull().default(""),
    /** 💨 Deal velocity: LOW | NORMAL | FAST | VERY_FAST | EXTREME */
    velocityLevel: text("velocity_level").notNull().default("NORMAL"),
    velocityScore: integer("velocity_score").notNull().default(50),
    /** 💎 Hidden gem score, 0 = ordinary listing. */
    hiddenGemScore: integer("hidden_gem_score").notNull().default(0),
    /** True when the product fields were machine-derived rather than certain. */
    aiParsed: integer("ai_parsed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("listings_canonical_idx").on(t.canonicalKey),
    index("listings_spec_idx").on(t.specKey),
    index("listings_seen_idx").on(t.lastSeenAt),
    index("listings_score_idx").on(t.dealScore),
    index("listings_status_idx").on(t.status),
    uniqueIndex("listings_external_uniq").on(t.marketplaceKey, t.externalId),
  ]
);

export const listingSnapshots = sqliteTable(
  "listing_snapshots",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id").notNull(),
    priceDkk: integer("price_dkk").notNull(),
    title: text("title"),
    imageUrl: text("image_url"),
    observedAt: ts("observed_at").notNull(),
    origin: text("origin").notNull().default("IMPORTED"),
  },
  (t) => [index("snapshots_listing_idx").on(t.listingId, t.observedAt)]
);

/**
 * Every price we have ever observed for a normalized specification, used as the
 * raw material for the market value engine. Never a hardcoded number.
 */
export const priceObservations = sqliteTable(
  "price_observations",
  {
    id: text("id").primaryKey(),
    specKey: text("spec_key").notNull(),
    canonicalKey: text("canonical_key").notNull(),
    priceDkk: integer("price_dkk").notNull(),
    condition: text("condition"),
    batteryHealth: integer("battery_health"),
    marketplaceKey: text("marketplace_key").notNull(),
    origin: text("origin").notNull().default("IMPORTED"),
    listingId: text("listing_id"),
    observedAt: ts("observed_at").notNull(),
  },
  (t) => [
    index("obs_spec_idx").on(t.specKey, t.observedAt),
    index("obs_canonical_idx").on(t.canonicalKey, t.observedAt),
  ]
);

export const marketEstimates = sqliteTable(
  "market_estimates",
  {
    specKey: text("spec_key").primaryKey(),
    canonicalKey: text("canonical_key").notNull(),
    sampleCount: integer("sample_count").notNull().default(0),
    medianDkk: integer("median_dkk"),
    p25Dkk: integer("p25_dkk"),
    p75Dkk: integer("p75_dkk"),
    avgDkk: integer("avg_dkk"),
    minDkk: integer("min_dkk"),
    maxDkk: integer("max_dkk"),
    fairValueDkk: integer("fair_value_dkk"),
    quickSaleDkk: integer("quick_sale_dkk"),
    trend7Pct: real("trend_7_pct"),
    trend30Pct: real("trend_30_pct"),
    confidence: text("confidence").notNull().default("NONE"),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("est_canonical_idx").on(t.canonicalKey)]
);

export const watchRules = sqliteTable("watch_rules", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  productType: text("product_type"),
  canonicalKey: text("canonical_key"),
  storageGb: integer("storage_gb"),
  maxPriceDkk: integer("max_price_dkk"),
  minDealScore: real("min_deal_score"),
  minProfitDkk: integer("min_profit_dkk"),
  marketplaces: json("marketplaces"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: ts("created_at").notNull(),
  lastMatchAt: ts("last_match_at"),
});

export const alertRules = sqliteTable("alert_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** deal_score | profit | discount | price_below | watchlist */
  kind: text("kind").notNull(),
  threshold: real("threshold").notNull(),
  canonicalKey: text("canonical_key"),
  productType: text("product_type"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
  lastFiredAt: ts("last_fired_at"),
  createdAt: ts("created_at").notNull(),
});

export const alerts = sqliteTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    ruleId: text("rule_id"),
    ruleName: text("rule_name").notNull(),
    listingId: text("listing_id"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    severity: text("severity").notNull().default("info"),
    /** URGENT | HOT | PRICE_DROP | TARGET_HIT | HIDDEN_GEM | RISK_CHANGE | INFO */
    category: text("category").notNull().default("INFO"),
    origin: text("origin").notNull().default("IMPORTED"),
    createdAt: ts("created_at").notNull(),
    readAt: ts("read_at"),
    deliveries: json("deliveries"),
    /**
     * Stable identity of a standing condition, so a re-analysis does not
     * re-alert on facts that have not changed.
     */
    dedupKey: text("dedup_key"),
  },
  (t) => [
    index("alerts_created_idx").on(t.createdAt),
    index("alerts_dedup_idx").on(t.dedupKey),
  ]
);

export const flips = sqliteTable("flips", {
  id: text("id").primaryKey(),
  listingId: text("listing_id"),
  productLabel: text("product_label").notNull(),
  canonicalKey: text("canonical_key"),
  storageGb: integer("storage_gb"),
  purchasePriceDkk: integer("purchase_price_dkk").notNull(),
  purchaseDate: ts("purchase_date").notNull(),
  purchaseMarketplace: text("purchase_marketplace"),
  expensesDkk: integer("expenses_dkk").notNull().default(0),
  salePriceDkk: integer("sale_price_dkk"),
  saleDate: ts("sale_date"),
  salePlatform: text("sale_platform"),
  /** CONTACTED | NEGOTIATING | PURCHASED | PREPARING | LISTED | SOLD */
  status: text("status").notNull().default("CONTACTED"),
  /** Offer price sent while negotiating, if any. */
  offerDkk: integer("offer_dkk"),
  listedForSaleAt: ts("listed_for_sale_at"),
  notes: text("notes").notNull().default(""),
  origin: text("origin").notNull().default("IMPORTED"),
  createdAt: ts("created_at").notNull(),
});

export const savedSearches = sqliteTable("saved_searches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  filters: json("filters").notNull(),
  createdAt: ts("created_at").notNull(),
});

export const sellerReferences = sqliteTable(
  "seller_references",
  {
    id: text("id").primaryKey(),
    marketplaceKey: text("marketplace_key").notNull(),
    handle: text("handle").notNull(),
    display: text("display"),
    listingCount: integer("listing_count").notNull().default(0),
    memberSince: text("member_since"),
    rating: real("rating"),
    meta: json("meta"),
    firstSeenAt: ts("first_seen_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull(),
    riskNotes: text("risk_notes").notNull().default(""),
  },
  (t) => [uniqueIndex("seller_uniq").on(t.marketplaceKey, t.handle)]
);

export const riskSignals = sqliteTable(
  "risk_signals",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id").notNull(),
    code: text("code").notNull(),
    phrase: text("phrase"),
    severity: text("severity").notNull(),
    weight: real("weight").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("risk_listing_idx").on(t.listingId)]
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: json("value").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const notificationLog = sqliteTable("notification_log", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: ts("created_at").notNull(),
});
