CREATE TABLE `shoot_notes` (
	`shoot_id` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`shoot_id`) REFERENCES `shoots`(`id`) ON UPDATE no action ON DELETE cascade
);
