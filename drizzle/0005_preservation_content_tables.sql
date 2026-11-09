CREATE TABLE preservation_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_intro TEXT NOT NULL DEFAULT '',
  freeze_title TEXT NOT NULL DEFAULT '',
  freeze_body TEXT NOT NULL DEFAULT '',
  freeze_case_source TEXT NOT NULL DEFAULT '',
  freeze_case_text TEXT NOT NULL DEFAULT '',
  freeze_visible INTEGER NOT NULL DEFAULT 1,
  dishonest_note TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE preservation_chain_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  step_label TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE preservation_feed_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  step_no INTEGER NOT NULL DEFAULT 1,
  source_label TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
