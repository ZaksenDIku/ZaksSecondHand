CREATE TABLE `alert_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`threshold` real NOT NULL,
	`canonical_key` text,
	`product_type` text,
	`enabled` integer DEFAULT true NOT NULL,
	`cooldown_minutes` integer DEFAULT 60 NOT NULL,
	`last_fired_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text,
	`rule_name` text NOT NULL,
	`listing_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`origin` text DEFAULT 'IMPORTED' NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	`deliveries` text
);
--> statement-breakpoint
CREATE INDEX `alerts_created_idx` ON `alerts` (`created_at`);--> statement-breakpoint
CREATE TABLE `flips` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text,
	`product_label` text NOT NULL,
	`canonical_key` text,
	`storage_gb` integer,
	`purchase_price_dkk` integer NOT NULL,
	`purchase_date` integer NOT NULL,
	`purchase_marketplace` text,
	`expenses_dkk` integer DEFAULT 0 NOT NULL,
	`sale_price_dkk` integer,
	`sale_date` integer,
	`sale_platform` text,
	`notes` text DEFAULT '' NOT NULL,
	`origin` text DEFAULT 'IMPORTED' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `listing_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`price_dkk` integer NOT NULL,
	`title` text,
	`image_url` text,
	`observed_at` integer NOT NULL,
	`origin` text DEFAULT 'IMPORTED' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snapshots_listing_idx` ON `listing_snapshots` (`listing_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`marketplace_key` text NOT NULL,
	`external_id` text,
	`url` text,
	`title` text NOT NULL,
	`raw_title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_dkk` integer NOT NULL,
	`original_price` integer,
	`image_url` text,
	`location` text,
	`posted_at` integer,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`origin` text DEFAULT 'IMPORTED' NOT NULL,
	`provider_status` text DEFAULT 'MANUAL' NOT NULL,
	`product_type` text,
	`brand` text,
	`model` text,
	`generation` text,
	`variant` text,
	`storage_gb` integer,
	`ram_gb` integer,
	`chip` text,
	`screen_size` text,
	`color` text,
	`year` integer,
	`condition` text,
	`battery_health` integer,
	`parse_confidence` real DEFAULT 0 NOT NULL,
	`parse_ambiguous` integer DEFAULT false NOT NULL,
	`canonical_key` text,
	`spec_key` text,
	`market_value_dkk` integer,
	`quick_sale_value_dkk` integer,
	`estimate_sample` integer DEFAULT 0 NOT NULL,
	`estimate_confidence` text DEFAULT 'NONE' NOT NULL,
	`discount_pct` real,
	`gross_profit_dkk` integer,
	`net_profit_dkk` integer,
	`roi_pct` real,
	`total_cost_dkk` integer,
	`deal_score` real DEFAULT 0 NOT NULL,
	`deal_tier` text DEFAULT 'FAIR' NOT NULL,
	`risk_score` real DEFAULT 0 NOT NULL,
	`risk_level` text DEFAULT 'LOW' NOT NULL,
	`score_factors` text,
	`duplicate_of` text,
	`duplicate_confidence` real,
	`fingerprint` text,
	`seller_handle` text,
	`seller_meta` text,
	`distance_km` real,
	`status` text DEFAULT 'active' NOT NULL,
	`watchlisted` integer DEFAULT false NOT NULL,
	`ignored` integer DEFAULT false NOT NULL,
	`contacted_at` integer,
	`purchased_at` integer,
	`price_changed_from` integer,
	`snapshot_count` integer DEFAULT 1 NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `listings_canonical_idx` ON `listings` (`canonical_key`);--> statement-breakpoint
CREATE INDEX `listings_spec_idx` ON `listings` (`spec_key`);--> statement-breakpoint
CREATE INDEX `listings_seen_idx` ON `listings` (`last_seen_at`);--> statement-breakpoint
CREATE INDEX `listings_score_idx` ON `listings` (`deal_score`);--> statement-breakpoint
CREATE INDEX `listings_status_idx` ON `listings` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `listings_external_uniq` ON `listings` (`marketplace_key`,`external_id`);--> statement-breakpoint
CREATE TABLE `market_estimates` (
	`spec_key` text PRIMARY KEY NOT NULL,
	`canonical_key` text NOT NULL,
	`sample_count` integer DEFAULT 0 NOT NULL,
	`median_dkk` integer,
	`p25_dkk` integer,
	`p75_dkk` integer,
	`avg_dkk` integer,
	`min_dkk` integer,
	`max_dkk` integer,
	`fair_value_dkk` integer,
	`quick_sale_dkk` integer,
	`trend_7_pct` real,
	`trend_30_pct` real,
	`confidence` text DEFAULT 'NONE' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `est_canonical_idx` ON `market_estimates` (`canonical_key`);--> statement-breakpoint
CREATE TABLE `marketplaces` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`access_status` text NOT NULL,
	`access_mode` text NOT NULL,
	`docs_url` text,
	`notes` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_sync_at` integer,
	`last_sync_error` text
);
--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`spec_key` text NOT NULL,
	`canonical_key` text NOT NULL,
	`price_dkk` integer NOT NULL,
	`condition` text,
	`battery_health` integer,
	`marketplace_key` text NOT NULL,
	`origin` text DEFAULT 'IMPORTED' NOT NULL,
	`listing_id` text,
	`observed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `obs_spec_idx` ON `price_observations` (`spec_key`,`observed_at`);--> statement-breakpoint
CREATE INDEX `obs_canonical_idx` ON `price_observations` (`canonical_key`,`observed_at`);--> statement-breakpoint
CREATE TABLE `risk_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`code` text NOT NULL,
	`phrase` text,
	`severity` text NOT NULL,
	`weight` real NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `risk_listing_idx` ON `risk_signals` (`listing_id`);--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`filters` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seller_references` (
	`id` text PRIMARY KEY NOT NULL,
	`marketplace_key` text NOT NULL,
	`handle` text NOT NULL,
	`display` text,
	`listing_count` integer DEFAULT 0 NOT NULL,
	`member_since` text,
	`rating` real,
	`meta` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`risk_notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seller_uniq` ON `seller_references` (`marketplace_key`,`handle`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watch_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`product_type` text,
	`canonical_key` text,
	`storage_gb` integer,
	`max_price_dkk` integer,
	`min_deal_score` real,
	`min_profit_dkk` integer,
	`marketplaces` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`last_match_at` integer
);
