-- ============================================================
-- Agent availability: a manual "away" flag. Away agents are skipped by
-- round-robin auto-assignment so new conversations don't pile up on someone
-- who has stepped out.
-- ============================================================
alter table workspace_members
  add column if not exists is_away boolean not null default false;
