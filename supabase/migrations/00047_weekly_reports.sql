-- ============================================================
-- Weekly email reports. When weekly_report_email is set, the daily jobs
-- cron emails a workspace summary at most once every ~7 days (gated by
-- last_report_sent_at), so no dedicated weekly cron is needed.
-- ============================================================
alter table workspaces
  add column if not exists weekly_report_email text;

alter table workspaces
  add column if not exists last_report_sent_at timestamptz;
