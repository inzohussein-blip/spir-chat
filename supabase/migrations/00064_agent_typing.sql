-- ============================================================
-- Agent typing indicator: mirrors visitor_typing_at in the other direction so
-- a website visitor can see "agent is typing…" while a teammate composes a
-- reply. Set by the agent inbox, read by the widget's message poll.
-- ============================================================
alter table conversations
  add column if not exists agent_typing_at timestamptz;
