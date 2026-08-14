-- Auto-assignment + SLA (feature 13).
-- auto_assign: 'off' | 'round_robin' (least-loaded agent).
-- sla_minutes: first-response target; 0 disables the SLA indicator.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS auto_assign text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS sla_minutes integer NOT NULL DEFAULT 0;
