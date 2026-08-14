-- Public API + webhooks (feature 18).
--
-- API keys authenticate external callers to the public REST API. Only a SHA-256
-- hash of the key is stored; the plaintext is shown once at creation time.
-- Webhook endpoints receive HMAC-signed event callbacks.

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  key_prefix text not null,          -- e.g. "sk_live_ab12cd" for display
  key_hash text not null unique,     -- sha256(full key)
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_api_keys_workspace on api_keys(workspace_id);
create index idx_api_keys_hash on api_keys(key_hash);

alter table api_keys enable row level security;
create policy "Users manage API keys in their workspaces"
  on api_keys for all
  using (is_workspace_member(workspace_id));

create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  url text not null,
  secret text not null,              -- used to HMAC-sign payloads
  events jsonb not null default '[]'::jsonb,  -- subscribed event names
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_webhook_endpoints_workspace on webhook_endpoints(workspace_id);

alter table webhook_endpoints enable row level security;
create policy "Users manage webhooks in their workspaces"
  on webhook_endpoints for all
  using (is_workspace_member(workspace_id));
