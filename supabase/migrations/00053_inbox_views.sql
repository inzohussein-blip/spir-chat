-- ============================================================
-- Saved inbox views: a named combination of inbox filters, shared across
-- the workspace.
-- ============================================================
create table inbox_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_inbox_views_workspace on inbox_views(workspace_id, created_at);

alter table inbox_views enable row level security;
create policy "Members manage inbox views in their workspaces"
  on inbox_views for all
  using (is_workspace_member(workspace_id));
