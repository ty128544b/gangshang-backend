CREATE TABLE auth_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_hash TEXT NOT NULL DEFAULT '',
  user_hash TEXT NOT NULL DEFAULT '',
  session_secret TEXT NOT NULL DEFAULT '',
  user_disabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
