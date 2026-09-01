-- ============================================================
-- Contact company/organization: a free-text field to record which company a
-- contact belongs to, so B2B teams can see and group by account.
-- ============================================================
alter table contacts
  add column if not exists company text;
