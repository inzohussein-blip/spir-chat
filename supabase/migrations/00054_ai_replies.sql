-- ============================================================
-- AI auto-reply: when on, a website visitor's message is answered from the
-- workspace's published Help Center articles (if the model is confident),
-- as long as the conversation is unassigned and automation isn't paused.
-- ============================================================
alter table workspaces
  add column if not exists ai_replies_enabled boolean not null default false;
