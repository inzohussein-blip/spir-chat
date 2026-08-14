-- Rich message content: link buttons + product cards/carousels (feature 12).
-- Stored as jsonb on the message so website conversations can render tappable
-- buttons and card carousels alongside plain text.
--
-- Shape (buttons):
--   { "type": "buttons", "buttons": [ { "label": "Buy now", "url": "https://…" } ] }
-- Shape (cards):
--   { "type": "cards", "cards": [ { "title","subtitle","imageUrl","url",
--                                   "buttons":[{ "label","url" }] } ] }

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS rich_content jsonb;
