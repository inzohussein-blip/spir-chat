-- ============================================================
-- Scheduling + Telegram for direct campaigns. A batch can now be scheduled for
-- later (the daily jobs cron drains it), carries a status, and remembers
-- whether to file recipients as contacts. Recipients start 'pending' and are
-- flipped to sent/failed as the batch is processed.
-- ============================================================
alter table outreach_batches
  add column if not exists status text not null default 'sent',   -- scheduled | sending | sent
  add column if not exists scheduled_at timestamptz,
  add column if not exists save_contacts boolean not null default false;

create index if not exists idx_outreach_batches_due
  on outreach_batches(scheduled_at)
  where status = 'scheduled';
