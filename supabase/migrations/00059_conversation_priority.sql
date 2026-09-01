-- ============================================================
-- Conversation priority: agents can flag a conversation as high or urgent so
-- it sorts to the top of the inbox and can be filtered. 0 = normal (default),
-- 1 = high, 2 = urgent.
-- ============================================================
alter table conversations
  add column if not exists priority smallint not null default 0;

-- Fast "urgent/high first, then most recent" ordering within a workspace.
create index if not exists idx_conversations_priority
  on conversations(workspace_id, priority desc, last_message_at desc);
