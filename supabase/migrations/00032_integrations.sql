-- Store/CRM integrations (feature 17).
-- One row per provider per workspace, holding the provider's connection config
-- (store domain + API token). Used to fetch a contact's recent orders and show
-- them as context in the inbox.
--
-- config shape:
--   shopify:     { "shopDomain": "x.myshopify.com", "accessToken": "shpat_…" }
--   woocommerce: { "storeUrl": "https://…", "consumerKey": "ck_…",
--                  "consumerSecret": "cs_…" }

create table integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null,             -- 'shopify' | 'woocommerce'
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index idx_integrations_workspace on integrations(workspace_id);

alter table integrations enable row level security;
create policy "Members manage integrations in their workspaces"
  on integrations for all
  using (is_workspace_member(workspace_id));
