CREATE TABLE `account_migrations` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_class_settings` (
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`starting_class` text NOT NULL,
	PRIMARY KEY(`user_id`, `event`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'shooter' NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `shoots` ADD `owner_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `idx_shoots_owner_date_id` ON `shoots` (`owner_id`,`date`,`id`);