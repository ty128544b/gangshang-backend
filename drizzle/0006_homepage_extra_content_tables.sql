CREATE TABLE today_repayments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_masked TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  time_text TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'full',
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE ticker_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE punishment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE payment_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payee_name TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  account_no TEXT NOT NULL DEFAULT '',
  qr_image_url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE demo_bill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debtor_name TEXT NOT NULL DEFAULT '',
  case_no TEXT NOT NULL DEFAULT '',
  total_due_cents INTEGER NOT NULL DEFAULT 0,
  principal_cents INTEGER NOT NULL DEFAULT 0,
  penalty_cents INTEGER NOT NULL DEFAULT 0,
  overdue_days INTEGER NOT NULL DEFAULT 0,
  original_creditor TEXT NOT NULL DEFAULT '',
  transfer_agreement_no TEXT NOT NULL DEFAULT ''
);
