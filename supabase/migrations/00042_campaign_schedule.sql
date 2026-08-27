-- ============================================================
-- Scheduled campaigns. A campaign with status 'scheduled' and a
-- scheduled_at in the past is delivered by the daily jobs cron.
-- (status is free text: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed')
-- ============================================================
alter table campaigns
  add column if not exists scheduled_at timestamptz;

create index if not exists idx_campaigns_scheduled
  on campaigns(scheduled_at)
  where status = 'scheduled';
