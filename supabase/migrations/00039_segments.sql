-- Audience segments (concept adapted from Parcelvoy's rule engine, MIT).
-- A segment is a saved set of contact filters campaigns can target instead of
-- "all subscribed contacts".

create table segments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_segments_workspace on segments(workspace_id);

alter table segments enable row level security;
create policy "Members manage segments in their workspaces"
  on segments for all
  using (is_workspace_member(workspace_id));

-- Campaigns can target a segment.
alter table campaigns
  add column if not exists segment_id uuid references segments(id) on delete set null;
