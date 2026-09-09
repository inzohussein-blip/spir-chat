-- ============================================================
-- WhatsApp Cloud template campaigns: a direct-campaign batch can send an
-- approved Meta message template (the compliant way to start conversations)
-- instead of free text. Stores the template name, language, and body params.
-- ============================================================
alter table outreach_batches
  add column if not exists template_name text,
  add column if not exists template_lang text,
  add column if not exists template_params jsonb;
