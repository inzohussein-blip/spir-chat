-- Conversation labels — borrowed from Chatwoot.
-- A per-workspace label taxonomy plus a join table assigning labels to
-- conversations, so agents can categorize and later filter the inbox.
create table labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index idx_labels_workspace on labels(workspace_id);

alter table labels enable row level security;
create policy "Users manage labels in their workspaces"
  on labels for all
  using (is_workspace_member(workspace_id));

create table conversation_labels (
  conversation_id uuid not null references conversations(id) on delete cascade,
  label_id uuid not null references labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, label_id)
);

alter table conversation_labels enable row level security;
create policy "Users manage conversation labels in their workspaces"
  on conversation_labels for all
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_labels.conversation_id
        and is_workspace_member(c.workspace_id)
    )
  );
