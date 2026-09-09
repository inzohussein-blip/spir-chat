-- ============================================================
-- Approved WhatsApp message templates synced from the workspace's WABA, so the
-- campaign composer can pick a template by name instead of typing it.
-- ============================================================
create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  language text not null,
  status text,
  category text,
  synced_at timestamptz not null default now(),
  unique (workspace_id, name, language)
);

create index idx_whatsapp_templates_workspace on whatsapp_templates(workspace_id);

alter table whatsapp_templates enable row level security;
create policy "Members read their workspace whatsapp templates"
  on whatsapp_templates for all
  using (is_workspace_member(workspace_id));
