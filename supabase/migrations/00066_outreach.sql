-- ============================================================
-- Direct campaigns (ad-hoc outreach): send a template to a pasted/uploaded list
-- of raw phone numbers or emails, immediately, without them being existing
-- contacts. A batch records the send; recipients record per-address outcomes.
-- ============================================================
create table outreach_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  channel text not null,                 -- email | sms | whatsapp
  message text not null,
  subject text,                          -- email only
  total integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_outreach_batches_workspace
  on outreach_batches(workspace_id, created_at desc);

create table outreach_recipients (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references outreach_batches(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  recipient text not null,               -- normalized phone/email
  contact_id uuid references contacts(id) on delete set null,
  status text not null default 'pending',-- sent | failed
  error text,
  created_at timestamptz not null default now()
);

create index idx_outreach_recipients_batch
  on outreach_recipients(batch_id);

alter table outreach_batches enable row level security;
alter table outreach_recipients enable row level security;

create policy "Members manage outreach batches in their workspaces"
  on outreach_batches for all
  using (is_workspace_member(workspace_id));

create policy "Members manage outreach recipients in their workspaces"
  on outreach_recipients for all
  using (is_workspace_member(workspace_id));
