-- Race-safe offline auto-reply guard (review follow-up).
-- Set atomically the first time we post the business-hours offline auto-reply
-- into a conversation, so two near-simultaneous first messages can't both send.

alter table conversations
  add column if not exists auto_reply_sent_at timestamptz;
