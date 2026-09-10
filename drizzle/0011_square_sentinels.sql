CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`source` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` integer NOT NULL,
	`undone_at` integer,
	`total` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "import_total_nonnegative" CHECK("import_batches"."total" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_import_batches_owner_created` ON `import_batches` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_records` (
	`batch_id` text NOT NULL,
	`shoot_id` integer NOT NULL,
	`snapshot` text NOT NULL,
	PRIMARY KEY(`batch_id`, `shoot_id`),
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `shoots` ADD `import_batch_id` text REFERENCES import_batches(id);--> statement-breakpoint
ALTER TABLE `shoots` ADD `import_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_shoots_owner_import_key` ON `shoots` (`owner_id`,`import_key`);--> statement-breakpoint
CREATE INDEX `idx_shoots_import_batch` ON `shoots` (`import_batch_id`);