-- Multi-channel campaigns: email / SMS / WhatsApp (feature 6).
-- Providers are called server-side via env-configured HTTP APIs (Resend for
-- email, Twilio for SMS/WhatsApp) — no per-provider tables needed here.

alter table contacts
  add column if not exists phone text;

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  channel text not null default 'email',   -- 'email' | 'sms' | 'whatsapp'
  subject text,                            -- email only
  body text not null default '',
  status text not null default 'draft',    -- 'draft' | 'sending' | 'sent' | 'failed'
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index idx_campaigns_workspace on campaigns(workspace_id);

alter table campaigns enable row level security;
create policy "Members manage campaigns in their workspaces"
  on campaigns for all
  using (is_workspace_member(workspace_id));
