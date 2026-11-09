DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debtor_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  case_no TEXT NOT NULL,
  total_due_cents INTEGER NOT NULL DEFAULT 0,
  overdue_days INTEGER NOT NULL DEFAULT 0,
  penalty_cents INTEGER NOT NULL DEFAULT 0,
  original_creditor TEXT NOT NULL DEFAULT '',
  transfer_agreement_no TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  last_sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE progress_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE send_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT '站内发送',
  message_text TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sent_at INTEGER NOT NULL
);
