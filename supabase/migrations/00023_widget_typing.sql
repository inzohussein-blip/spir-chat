-- Website visitor "is typing" signal (Tidio-style). Set on each typing ping;
-- the inbox treats the visitor as typing only within a few seconds of it.
alter table conversations
  add column if not exists visitor_typing_at timestamptz;
