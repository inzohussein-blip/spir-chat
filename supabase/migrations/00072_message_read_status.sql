-- ============================================================
-- Allow a "read" message status so WhatsApp read receipts (blue ✓✓) are
-- distinct from plain delivered.
-- ============================================================
alter table messages drop constraint if exists messages_status_check;
alter table messages
  add constraint messages_status_check
  check (status in ('pending', 'sent', 'delivered', 'read', 'failed'));
