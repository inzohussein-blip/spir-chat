-- Tracked links + click analytics (adapted from OpenReply, MIT).
-- A tracked link swaps a destination URL for a short /r/<slug> redirect that
-- records a click before forwarding, so campaigns and growth automations can
-- measure clicks and CTR.

create table tracked_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  slug text not null unique,
  label text,
  destination_url text not null,
  created_at timestamptz not null default now()
);

create index idx_tracked_links_workspace on tracked_links(workspace_id);
create index idx_tracked_links_campaign on tracked_links(campaign_id);

alter table tracked_links enable row level security;
create policy "Members manage tracked links in their workspaces"
  on tracked_links for all
  using (is_workspace_member(workspace_id));

create table link_clicks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tracked_link_id uuid not null references tracked_links(id) on delete cascade,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

create index idx_link_clicks_link on link_clicks(tracked_link_id);
create index idx_link_clicks_workspace_created on link_clicks(workspace_id, created_at);

alter table link_clicks enable row level security;
-- Members read click analytics; clicks are inserted by the public /r route via
-- the service role.
create policy "Members read link clicks in their workspaces"
  on link_clicks for select
  using (is_workspace_member(workspace_id));
