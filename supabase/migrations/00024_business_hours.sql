-- Business hours + auto-reply (feature 14).
-- Stored per workspace as a single jsonb blob so no per-day tables are needed.
--
-- Shape:
-- {
--   "enabled": true,
--   "timezone": "Asia/Baghdad",
--   "days": {
--     "0": { "open": false },                       -- Sunday
--     "1": { "open": true, "from": "09:00", "to": "17:00" },
--     ...
--     "6": { "open": false }
--   },
--   "replyOffline": "We're closed right now — leave a message and we'll reply.",
--   "replyOnline": null
-- }

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb;
