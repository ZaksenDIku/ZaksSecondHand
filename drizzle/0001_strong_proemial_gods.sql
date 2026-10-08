ALTER TABLE `flips` ADD `status` text DEFAULT 'CONTACTED' NOT NULL;--> statement-breakpoint
ALTER TABLE `flips` ADD `offer_dkk` integer;--> statement-breakpoint
ALTER TABLE `flips` ADD `listed_for_sale_at` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `velocity_level` text DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `velocity_score` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `hidden_gem_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `ai_parsed` integer DEFAULT false NOT NULL;