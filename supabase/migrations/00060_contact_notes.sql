-- ============================================================
-- Contact-level notes: private team notes attached to a contact (not a single
-- conversation), so context like "VIP", "prefers Arabic", or "refund pending"
-- persists across every conversation the contact starts. Mirrors
-- conversation_notes but keyed on the contact.
-- ============================================================
create table contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_contact_notes_contact
  on contact_notes(contact_id, created_at desc);

alter table contact_notes enable row level security;

create policy "Users manage contact notes in their workspaces"
  on contact_notes for all
  using (is_workspace_member(workspace_id));
