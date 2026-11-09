CREATE TABLE `operators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`password_hash` text DEFAULT '' NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`fail_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `cases` ADD COLUMN `muted_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `cases` ADD COLUMN `assignee_id` integer;
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD COLUMN `actor_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `agreements` ADD COLUMN `created_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `recorded_by` text DEFAULT '' NOT NULL;
