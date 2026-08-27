-- ============================================================
-- Per-recipient delivery log for campaigns, so each campaign has a
-- real send report (who was reached, what failed and why).
-- ============================================================
create table campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  recipient text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index idx_campaign_recipients_campaign on campaign_recipients(campaign_id, created_at desc);

alter table campaign_recipients enable row level security;
create policy "Members view campaign recipients in their workspaces"
  on campaign_recipients for all
  using (is_workspace_member(workspace_id));
