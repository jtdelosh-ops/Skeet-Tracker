CREATE TABLE `event_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shoot_id` integer NOT NULL,
	`event` text NOT NULL,
	`broken` integer NOT NULL,
	`targets` integer NOT NULL,
	`class_shot` text,
	FOREIGN KEY (`shoot_id`) REFERENCES `shoots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_event_scores_shoot_event` ON `event_scores` (`shoot_id`,`event`);--> statement-breakpoint
CREATE TABLE `shoots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shoot_number` integer,
	`name` text NOT NULL,
	`date` text NOT NULL
);
