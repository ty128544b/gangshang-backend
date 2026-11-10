CREATE TABLE `techniques` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `case_id` integer,
  `technique` text DEFAULT '' NOT NULL,
  `source` text DEFAULT 'auto' NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `confirmed_by` text DEFAULT '' NOT NULL,
  `confirmed_at` integer,
  `created_at` integer NOT NULL
);
