ALTER TABLE `auth_credentials` ADD COLUMN `admin_fail_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `auth_credentials` ADD COLUMN `admin_locked_until` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `auth_credentials` ADD COLUMN `user_fail_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `auth_credentials` ADD COLUMN `user_locked_until` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `verify_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id_card` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
