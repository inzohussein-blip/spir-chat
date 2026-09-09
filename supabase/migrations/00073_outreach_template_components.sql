-- ============================================================
-- Rich WhatsApp template components for direct campaigns: an optional header
-- (text or media) and a dynamic URL button parameter, alongside the existing
-- body params. Stored as a small JSON object on the batch.
-- ============================================================
alter table outreach_batches
  add column if not exists template_components jsonb;
