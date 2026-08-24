-- Carry link buttons through the DM retry queue so a rate-limited retry resends
-- the exact button template (not degraded plain text).

alter table dm_jobs
  add column if not exists buttons jsonb;
