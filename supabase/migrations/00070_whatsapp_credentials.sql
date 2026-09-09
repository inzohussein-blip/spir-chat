-- ============================================================
-- Per-workspace official WhatsApp (Meta Cloud API) connection. Lets each
-- workspace connect its own number instead of a single deployment-wide env
-- number. The access token is stored encrypted; the display fields are read
-- from Graph API at connect time so the UI can show the recognized number.
-- ============================================================
create table whatsapp_credentials (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  phone_number_id text not null,
  waba_id text,
  display_number text,
  verified_name text,
  access_token text not null,        -- AES-256-GCM encrypted
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Map an inbound webhook's phone_number_id back to its workspace.
create index idx_whatsapp_credentials_phone on whatsapp_credentials(phone_number_id);

alter table whatsapp_credentials enable row level security;
-- Members can see that a connection exists (display fields); writes go through
-- the server action with the service role, and the token is never sent to the
-- client by the app.
create policy "Members read their workspace whatsapp connection"
  on whatsapp_credentials for select
  using (is_workspace_member(workspace_id));
