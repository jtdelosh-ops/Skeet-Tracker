ALTER TABLE `invitations` ADD `email_status` text DEFAULT 'not_sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `invitations` ADD `sent_at` integer;