ALTER TABLE `alerts` ADD `dedup_key` text;--> statement-breakpoint
CREATE INDEX `alerts_dedup_idx` ON `alerts` (`dedup_key`);