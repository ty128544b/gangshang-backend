CREATE TABLE `lawyer_progress_steps` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `title` text DEFAULT '' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `date_label` text DEFAULT '' NOT NULL,
  `state` text DEFAULT 'todo' NOT NULL
);
