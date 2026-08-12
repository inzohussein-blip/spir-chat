-- Website visitor presence (Tidio-style "online now" + current page).
-- Stored on the conversation; only website conversations set these.
alter table conversations
  add column if not exists visitor_last_seen_at timestamptz,
  add column if not exists visitor_current_page text;
