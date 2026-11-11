CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`target_kind` text DEFAULT '' NOT NULL,
	`target_id` integer,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
---> statement-breakpoint
CREATE TABLE `deleted_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`item_id` integer,
	`label` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`deleted_by` text DEFAULT '' NOT NULL,
	`deleted_at` integer NOT NULL
);
