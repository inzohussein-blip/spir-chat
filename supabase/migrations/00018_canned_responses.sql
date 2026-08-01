-- Canned responses (saved replies) — borrowed from Chatwoot.
-- Agents store reusable replies keyed by a short code and insert them into the
-- inbox composer with one click.
create table canned_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  short_code text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, short_code)
);

create index idx_canned_responses_workspace on canned_responses(workspace_id);

alter table canned_responses enable row level security;

create policy "Users manage canned responses in their workspaces"
  on canned_responses for all
  using (is_workspace_member(workspace_id));

create trigger set_updated_at before update on canned_responses
  for each row execute function update_updated_at();
