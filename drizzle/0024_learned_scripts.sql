CREATE TABLE `model_replies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `case_id` integer NOT NULL,
  `trigger` text NOT NULL DEFAULT '',
  `reply` text NOT NULL DEFAULT '',
  `promoted` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);
---> statement-breakpoint
CREATE TABLE `learned_scripts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `text` text NOT NULL,
  `normalized` text NOT NULL,
  `trigger` text NOT NULL DEFAULT '',
  `source_case_id` integer NOT NULL,
  `use_count` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL
);
---> statement-breakpoint
CREATE UNIQUE INDEX `learned_scripts_normalized_idx` ON `learned_scripts` (`normalized`);
