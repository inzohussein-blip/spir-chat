-- Direct Meta (Instagram Graph API) connection alongside Zernio (Phase 4).
--
-- A Meta-connected Instagram account is a normal channels row (platform
-- 'instagram') so all existing automation keyed on channel_id keeps working.
-- Its secrets live here, in a service-role-only table (RLS enabled with NO
-- member policy → only the service role reads the access token).

create table meta_credentials (
  channel_id uuid primary key references channels(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  ig_user_id text not null unique,
  page_id text,
  username text,
  access_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_meta_credentials_ig_user on meta_credentials(ig_user_id);
create index idx_meta_credentials_workspace on meta_credentials(workspace_id);

-- RLS on, no policies: members never read tokens; only the service role
-- (OAuth callback, webhook, senders, token-refresh cron) touches this table.
alter table meta_credentials enable row level security;

-- Retry safety-net for Meta sends that fail on the instant path (rate limit /
-- transient error). Drained by the token-refresh cron. Not a full queue — the
-- happy path sends inline via after().
create table dm_jobs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  comment_id text,
  recipient_id text not null,
  message text not null,
  status text not null default 'pending',   -- 'pending' | 'done' | 'failed'
  attempts integer not null default 0,
  last_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_dm_jobs_drain on dm_jobs(status, run_after);
create index idx_dm_jobs_channel on dm_jobs(channel_id);

alter table dm_jobs enable row level security;
create policy "Members read dm jobs in their workspaces"
  on dm_jobs for select
  using (is_workspace_member(workspace_id));
