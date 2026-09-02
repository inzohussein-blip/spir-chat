-- ============================================================
-- Auto-close stale conversations: the daily jobs cron resolves open
-- conversations with no activity for this many days. 0 = disabled (default).
-- ============================================================
alter table workspaces
  add column if not exists auto_close_days integer not null default 0;
