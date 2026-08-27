-- ============================================================
-- Macros — saved bundles of actions an agent runs on a conversation
-- in one click (concept borrowed from Chatwoot, MIT).
-- Each action is { type, value }; types: add_label, remove_label,
-- assign, send_message, set_status.
-- ============================================================
create table macros (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_macros_workspace on macros(workspace_id);

alter table macros enable row level security;
create policy "Members manage macros in their workspaces"
  on macros for all
  using (is_workspace_member(workspace_id));
