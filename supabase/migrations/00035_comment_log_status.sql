-- Structured comment-automation outcomes + rate-limit visibility (Phase 2,
-- inspired by OpenReply's DmStatus / SKIPPED_RATE_LIMIT).
--
-- status values: 'processing' (claimed, race guard) | 'no_match' | 'sent'
--   | 'reply_only' | 'skipped_rate_limit' | 'failed'

alter table comment_logs
  add column if not exists status text;
