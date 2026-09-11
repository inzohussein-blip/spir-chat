-- 00074_campaign_providers.sql
-- Per-workspace campaign provider credentials, so email/SMS/Telegram can be
-- configured from the app instead of only deployment-wide env vars. Secret
-- fields are stored encrypted (AES-256-GCM via META_TOKEN_KEY); the rest are
-- plain identifiers. Workspace values take priority over env at send time.

alter table workspaces
  add column if not exists resend_api_key text,          -- encrypted
  add column if not exists campaign_from_email text,
  add column if not exists twilio_account_sid text,
  add column if not exists twilio_auth_token text,       -- encrypted
  add column if not exists twilio_sms_from text,
  add column if not exists twilio_whatsapp_from text,
  add column if not exists telegram_gateway_url text,
  add column if not exists telegram_gateway_token text;   -- encrypted
