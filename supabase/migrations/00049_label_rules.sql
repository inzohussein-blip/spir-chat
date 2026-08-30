-- ============================================================
-- Auto-labeling: when an inbound message contains a rule's keyword, the
-- matching label is applied to its conversation.
-- ============================================================
create table label_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  keyword text not null,
  label_id uuid not null references labels(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_label_rules_workspace on label_rules(workspace_id);

alter table label_rules enable row level security;
create policy "Members manage label rules in their workspaces"
  on label_rules for all
  using (is_workspace_member(workspace_id));
