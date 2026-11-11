CREATE TABLE `system_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`blob_key` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`case_count` integer DEFAULT 0 NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
