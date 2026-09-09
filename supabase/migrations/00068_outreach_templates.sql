-- ============================================================
-- Direct-campaign templates: reusable message presets for outreach, separate
-- from inbox saved replies. Support merge variables like {{phone}} / {{email}}.
-- ============================================================
create table outreach_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_outreach_templates_workspace
  on outreach_templates(workspace_id, name);

alter table outreach_templates enable row level security;
create policy "Members manage outreach templates in their workspaces"
  on outreach_templates for all
  using (is_workspace_member(workspace_id));
