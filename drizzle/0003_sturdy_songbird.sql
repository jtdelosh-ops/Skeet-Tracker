ALTER TABLE `event_scores` ADD `shot_date` text;--> statement-breakpoint
ALTER TABLE `shoots` ADD `status` text DEFAULT 'complete' NOT NULL;