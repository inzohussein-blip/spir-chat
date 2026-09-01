-- ============================================================
-- Agent presence: track when each member was last active so the team can see
-- who is online. Updated by a lightweight heartbeat while the dashboard is open.
-- ============================================================
alter table workspace_members
  add column if not exists last_seen_at timestamptz;
