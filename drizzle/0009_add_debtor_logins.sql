CREATE TABLE `debtor_logins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
