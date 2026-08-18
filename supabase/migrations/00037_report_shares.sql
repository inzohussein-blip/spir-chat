-- Shareable public link/click reports (from OpenReply's shareable campaign
-- reports, MIT). A report_shares row exposes a workspace's tracked-link
-- analytics at a public /reports/<slug> URL (read-only, no auth).

create table report_shares (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug text not null unique,
  title text,
  created_at timestamptz not null default now()
);

create index idx_report_shares_workspace on report_shares(workspace_id);

alter table report_shares enable row level security;
create policy "Members manage report shares in their workspaces"
  on report_shares for all
  using (is_workspace_member(workspace_id));
-- Public reads happen via the service role on the /reports route.
