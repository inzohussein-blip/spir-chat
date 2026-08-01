-- Internal notes on conversations — borrowed from Chatwoot.
-- Private to the workspace team; never sent to the contact. Kept in a dedicated
-- table (not messages) so notes work for every conversation, including social
-- threads whose messages live in Zernio rather than our messages table.
create table conversation_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_conversation_notes_conversation
  on conversation_notes(conversation_id, created_at);

alter table conversation_notes enable row level security;

-- Workspace members can read and write notes in their own workspaces. For an
-- ALL policy the USING expression is also applied as the INSERT check.
create policy "Users manage notes in their workspaces"
  on conversation_notes for all
  using (is_workspace_member(workspace_id));
