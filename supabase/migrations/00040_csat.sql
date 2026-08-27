-- ============================================================
-- CSAT (customer satisfaction) surveys.
-- Concept adapted from Chatwoot's post-resolution CSAT (MIT).
-- One survey per conversation; the contact rates 1-5 via a public
-- tokenized link, so it works across every channel.
-- ============================================================
create table csat_surveys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'responded')),
  rating smallint check (rating between 1 and 5),
  feedback text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (conversation_id)
);

create index idx_csat_workspace on csat_surveys(workspace_id, created_at desc);
create index idx_csat_token on csat_surveys(token);

alter table csat_surveys enable row level security;

-- Members read/manage surveys in their workspaces. The public rating page
-- reads and writes with the service role (token-scoped), bypassing RLS.
create policy "Members view csat in their workspaces"
  on csat_surveys for all
  using (is_workspace_member(workspace_id));
