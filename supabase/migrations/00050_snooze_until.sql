-- ============================================================
-- Timed snooze: a snoozed conversation with snooze_until in the past is
-- reopened automatically by the daily jobs cron.
-- ============================================================
alter table conversations
  add column if not exists snooze_until timestamptz;

create index if not exists idx_conversations_snooze
  on conversations(snooze_until)
  where status = 'snoozed' and snooze_until is not null;
