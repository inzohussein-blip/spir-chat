-- Per-widget configuration for the website live-chat widget.
-- Holds the pre-chat form toggle and greeting (Chatwoot-style):
--   { "prechat": boolean, "greeting": string }
alter table channels
  add column if not exists widget_config jsonb not null default '{}'::jsonb;
