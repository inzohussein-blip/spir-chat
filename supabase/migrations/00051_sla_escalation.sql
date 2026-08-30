-- ============================================================
-- SLA escalation bookkeeping: stamp when a breached conversation was
-- escalated so the cron notifies at most once per breach.
-- ============================================================
alter table conversations
  add column if not exists sla_escalated_at timestamptz;
