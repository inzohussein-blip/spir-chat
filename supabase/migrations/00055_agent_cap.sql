-- ============================================================
-- Round-robin auto-assign respects a per-agent open-conversation cap.
-- 0 means no cap.
-- ============================================================
alter table workspaces
  add column if not exists agent_conversation_cap integer not null default 0;
