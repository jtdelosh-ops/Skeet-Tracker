CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`digest` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`redeemed_at` integer,
	`redeemed_by` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redeemed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_digest_unique` ON `invitations` (`digest`);--> statement-breakpoint
CREATE INDEX `idx_invitations_email_created` ON `invitations` (`email`,`created_at`);--> statement-breakpoint
ALTER TABLE `login_challenges` ADD `invitation_id` text REFERENCES invitations(id);--> statement-breakpoint
ALTER TABLE `login_challenges` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `support_access_acknowledged_at` integer;