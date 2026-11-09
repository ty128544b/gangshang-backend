ALTER TABLE cases ADD COLUMN principal_cents INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE cases ADD COLUMN needs_human INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE cases ADD COLUMN human_note TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  sender TEXT NOT NULL DEFAULT 'debtor',
  text TEXT NOT NULL,
  analysis TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'installment',
  detail TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  paid_on TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  screenshot_blob_key TEXT,
  reconcile_status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE court_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_no TEXT NOT NULL,
  court_name TEXT NOT NULL DEFAULT '',
  debtor_label TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT '',
  concluded_on TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE lawyer_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
