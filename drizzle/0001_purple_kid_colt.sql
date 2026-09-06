DROP INDEX `idx_event_scores_shoot_event`;--> statement-breakpoint
ALTER TABLE `event_scores` ADD `sequence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `event_scores` ADD `label` text DEFAULT 'Main' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_event_scores_shoot_sequence` ON `event_scores` (`shoot_id`,`sequence`);