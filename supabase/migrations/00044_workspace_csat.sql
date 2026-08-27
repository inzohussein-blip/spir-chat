-- ============================================================
-- Per-workspace toggle: when on, resolving a conversation automatically
-- sends the contact a CSAT survey link.
-- ============================================================
alter table workspaces
  add column if not exists csat_enabled boolean not null default false;
