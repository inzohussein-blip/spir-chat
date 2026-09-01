-- ============================================================
-- Visitor follow-up: if a website visitor goes quiet after being replied to,
-- the daily jobs cron sends one follow-up nudge (once per idle period).
-- ============================================================
alter table workspaces
  add column if not exists visitor_followup_minutes integer not null default 0;
alter table workspaces
  add column if not exists visitor_followup_message text;

alter table conversations
  add column if not exists followup_sent_at timestamptz;
