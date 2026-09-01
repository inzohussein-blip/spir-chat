-- SpirChat — full database schema (consolidated from migrations/00001..latest).
-- Run ONCE in the Supabase SQL Editor on a fresh project to create everything.
-- Source of truth is migrations/; regenerate this file if you add migrations.


-- ============================================================
-- 00001_initial_schema.sql
-- ============================================================
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- WORKSPACES
-- ============================================================
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  late_api_key_encrypted text,
  global_keywords jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index idx_workspace_members_user on workspace_members(user_id);

-- ============================================================
-- CHANNELS
-- ============================================================
create table channels (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'twitter', 'telegram', 'bluesky', 'reddit')),
  late_account_id text not null,
  username text,
  display_name text,
  profile_picture text,
  webhook_id text,
  webhook_secret text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, late_account_id)
);

create index idx_channels_workspace on channels(workspace_id);

-- ============================================================
-- CONTACTS (CRM)
-- ============================================================
create table contacts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  is_subscribed boolean not null default true,
  last_interaction_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contacts_workspace on contacts(workspace_id);
create index idx_contacts_last_interaction on contacts(workspace_id, last_interaction_at desc);

create table contact_channels (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  platform_sender_id text not null,
  platform_username text,
  created_at timestamptz not null default now(),
  unique (channel_id, platform_sender_id)
);

create index idx_contact_channels_contact on contact_channels(contact_id);

create table tags (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table contact_tags (
  contact_id uuid not null references contacts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

create table custom_field_definitions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  type text not null default 'text' check (type in ('text', 'number', 'boolean', 'date', 'url', 'email')),
  created_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create table contact_custom_fields (
  contact_id uuid not null references contacts(id) on delete cascade,
  field_id uuid not null references custom_field_definitions(id) on delete cascade,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (contact_id, field_id)
);

-- ============================================================
-- FLOWS
-- ============================================================
create table flows (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  viewport jsonb,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flows_workspace on flows(workspace_id);
create index idx_flows_status on flows(workspace_id, status);

create table triggers (
  id uuid primary key default uuid_generate_v4(),
  flow_id uuid not null references flows(id) on delete cascade,
  channel_id uuid references channels(id) on delete set null,
  type text not null check (type in ('keyword', 'postback', 'quick_reply', 'welcome', 'default', 'comment_keyword')),
  config jsonb not null default '{}'::jsonb,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_triggers_channel_type on triggers(channel_id, type, is_active);
create index idx_triggers_flow on triggers(flow_id);

create table flow_sessions (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references contacts(id) on delete cascade,
  flow_id uuid not null references flows(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'expired', 'cancelled')),
  current_node_id text,
  variables jsonb not null default '{}'::jsonb,
  flow_stack jsonb not null default '[]'::jsonb,
  waiting_until timestamptz,
  waiting_for_input boolean not null default false,
  human_takeover_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flow_sessions_contact_active on flow_sessions(contact_id, channel_id) where status = 'active';

-- ============================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  late_conversation_id text,
  platform text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'snoozed')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer not null default 0,
  is_automation_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, contact_id)
);

create index idx_conversations_workspace on conversations(workspace_id, last_message_at desc);
create index idx_conversations_status on conversations(workspace_id, status);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  text text,
  attachments jsonb,
  quick_reply_payload text,
  postback_payload text,
  callback_data text,
  platform_message_id text,
  sent_by_flow_id uuid references flows(id) on delete set null,
  sent_by_node_id text,
  sent_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'sent' check (status in ('pending', 'sent', 'delivered', 'failed')),
  created_at timestamptz not null default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at);

-- ============================================================
-- BROADCASTS
-- ============================================================
create table broadcasts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  message_content jsonb not null default '{}'::jsonb,
  segment_filter jsonb,
  scheduled_for timestamptz,
  total_recipients integer not null default 0,
  sent integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_broadcasts_workspace on broadcasts(workspace_id);

create table broadcast_recipients (
  id uuid primary key default uuid_generate_v4(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  status text not null default 'pending',
  sent_at timestamptz,
  error_message text
);

create index idx_broadcast_recipients_broadcast on broadcast_recipients(broadcast_id, status);

-- ============================================================
-- JOBS & ANALYTICS
-- ============================================================
create table scheduled_jobs (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index idx_scheduled_jobs_pending on scheduled_jobs(run_at) where status = 'pending';

create table analytics_events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  flow_id uuid references flows(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_analytics_workspace on analytics_events(workspace_id, created_at desc);
create index idx_analytics_flow on analytics_events(flow_id, created_at desc);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on workspaces for each row execute function update_updated_at();
create trigger set_updated_at before update on channels for each row execute function update_updated_at();
create trigger set_updated_at before update on contacts for each row execute function update_updated_at();
create trigger set_updated_at before update on flows for each row execute function update_updated_at();
create trigger set_updated_at before update on flow_sessions for each row execute function update_updated_at();
create trigger set_updated_at before update on conversations for each row execute function update_updated_at();
create trigger set_updated_at before update on broadcasts for each row execute function update_updated_at();

-- ============================================================
-- AUTO-CREATE WORKSPACE ON SIGNUP
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
declare
  ws_id uuid;
  user_name text;
  workspace_slug text;
begin
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  workspace_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(new.id::text, 1, 8);

  insert into public.workspaces (name, slug)
  values (user_name || '''s Workspace', workspace_slug)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
exception when others then
  raise log 'handle_new_user error: % %', sqlerrm, sqlstate;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 00002_rls_policies.sql
-- ============================================================
-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
-- All tables are filtered by workspace_id.
-- Users can only access rows in workspaces they belong to.
-- Service role key bypasses RLS (used in webhook handler).
-- ============================================================

-- Helper function: check if user belongs to workspace
create or replace function is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- ============================================================
-- WORKSPACES
-- ============================================================
alter table workspaces enable row level security;

create policy "Users can view their workspaces"
  on workspaces for select
  using (is_workspace_member(id));

create policy "Users can update their workspaces"
  on workspaces for update
  using (is_workspace_member(id));

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
alter table workspace_members enable row level security;

-- SELECT uses direct user_id check to avoid infinite recursion
-- (is_workspace_member queries workspace_members, which would trigger RLS again)
create policy "Members can view their workspace memberships"
  on workspace_members for select
  using (user_id = auth.uid());

create policy "Owners can insert members"
  on workspace_members for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "Owners can update members"
  on workspace_members for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "Owners can delete members"
  on workspace_members for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- ============================================================
-- CHANNELS
-- ============================================================
alter table channels enable row level security;

create policy "Users can view channels in their workspaces"
  on channels for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage channels in their workspaces"
  on channels for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- CONTACTS
-- ============================================================
alter table contacts enable row level security;

create policy "Users can view contacts in their workspaces"
  on contacts for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage contacts in their workspaces"
  on contacts for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- CONTACT CHANNELS
-- ============================================================
alter table contact_channels enable row level security;

create policy "Users can view contact channels via contact"
  on contact_channels for select
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_channels.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

create policy "Users can manage contact channels"
  on contact_channels for all
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_channels.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

-- ============================================================
-- TAGS
-- ============================================================
alter table tags enable row level security;

create policy "Users can view tags in their workspaces"
  on tags for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage tags in their workspaces"
  on tags for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- CONTACT TAGS
-- ============================================================
alter table contact_tags enable row level security;

create policy "Users can view contact tags"
  on contact_tags for select
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_tags.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

create policy "Users can manage contact tags"
  on contact_tags for all
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_tags.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

-- ============================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================
alter table custom_field_definitions enable row level security;

create policy "Users can view custom fields in their workspaces"
  on custom_field_definitions for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage custom fields in their workspaces"
  on custom_field_definitions for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- CONTACT CUSTOM FIELDS
-- ============================================================
alter table contact_custom_fields enable row level security;

create policy "Users can view contact custom fields"
  on contact_custom_fields for select
  using (
    exists (
      select 1 from contacts c
      join contact_custom_fields ccf on ccf.contact_id = c.id
      where c.id = contact_custom_fields.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

create policy "Users can manage contact custom fields"
  on contact_custom_fields for all
  using (
    exists (
      select 1 from contacts c
      where c.id = contact_custom_fields.contact_id
        and is_workspace_member(c.workspace_id)
    )
  );

-- ============================================================
-- FLOWS
-- ============================================================
alter table flows enable row level security;

create policy "Users can view flows in their workspaces"
  on flows for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage flows in their workspaces"
  on flows for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- TRIGGERS
-- ============================================================
alter table triggers enable row level security;

create policy "Users can view triggers via flow"
  on triggers for select
  using (
    exists (
      select 1 from flows f
      where f.id = triggers.flow_id
        and is_workspace_member(f.workspace_id)
    )
  );

create policy "Users can manage triggers via flow"
  on triggers for all
  using (
    exists (
      select 1 from flows f
      where f.id = triggers.flow_id
        and is_workspace_member(f.workspace_id)
    )
  );

-- ============================================================
-- FLOW SESSIONS
-- ============================================================
alter table flow_sessions enable row level security;

create policy "Users can view flow sessions via flow"
  on flow_sessions for select
  using (
    exists (
      select 1 from flows f
      where f.id = flow_sessions.flow_id
        and is_workspace_member(f.workspace_id)
    )
  );

-- ============================================================
-- CONVERSATIONS
-- ============================================================
alter table conversations enable row level security;

create policy "Users can view conversations in their workspaces"
  on conversations for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage conversations in their workspaces"
  on conversations for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- MESSAGES
-- ============================================================
alter table messages enable row level security;

create policy "Users can view messages via conversation"
  on messages for select
  using (
    exists (
      select 1 from conversations conv
      where conv.id = messages.conversation_id
        and is_workspace_member(conv.workspace_id)
    )
  );

create policy "Users can insert messages via conversation"
  on messages for insert
  with check (
    exists (
      select 1 from conversations conv
      where conv.id = messages.conversation_id
        and is_workspace_member(conv.workspace_id)
    )
  );

-- ============================================================
-- BROADCASTS
-- ============================================================
alter table broadcasts enable row level security;

create policy "Users can view broadcasts in their workspaces"
  on broadcasts for select
  using (is_workspace_member(workspace_id));

create policy "Users can manage broadcasts in their workspaces"
  on broadcasts for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- BROADCAST RECIPIENTS
-- ============================================================
alter table broadcast_recipients enable row level security;

create policy "Users can view broadcast recipients"
  on broadcast_recipients for select
  using (
    exists (
      select 1 from broadcasts b
      where b.id = broadcast_recipients.broadcast_id
        and is_workspace_member(b.workspace_id)
    )
  );

-- ============================================================
-- SCHEDULED JOBS (service role only, no user RLS needed)
-- ============================================================
alter table scheduled_jobs enable row level security;

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
alter table analytics_events enable row level security;

create policy "Users can view analytics in their workspaces"
  on analytics_events for select
  using (is_workspace_member(workspace_id));

create policy "Users can insert analytics in their workspaces"
  on analytics_events for insert
  with check (is_workspace_member(workspace_id));

-- ============================================================
-- 00003_rpc_functions.sql
-- ============================================================
-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Increment unread count and update conversation preview
create or replace function increment_unread(conv_id uuid, preview text)
returns void as $$
begin
  update conversations
  set unread_count = unread_count + 1,
      last_message_at = now(),
      last_message_preview = preview,
      status = 'open'
  where id = conv_id;
end;
$$ language plpgsql security definer;

-- Increment broadcast sent counter
create or replace function increment_broadcast_sent(b_id uuid)
returns void as $$
begin
  update broadcasts
  set sent = sent + 1,
      delivered = delivered + 1
  where id = b_id;
end;
$$ language plpgsql security definer;

-- Increment broadcast failed counter
create or replace function increment_broadcast_failed(b_id uuid)
returns void as $$
begin
  update broadcasts
  set failed = failed + 1
  where id = b_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 00004_comment_automation.sql
-- ============================================================
-- ============================================================
-- COMMENT AUTOMATION
-- ============================================================

-- Add comment polling cursor to channels
alter table channels
  add column if not exists last_comment_cursor text,
  add column if not exists comment_rules jsonb default '[]'::jsonb;

-- Comment processing log
create table if not exists comment_logs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  post_id text, -- Late post ID the comment belongs to
  platform_comment_id text not null,
  author_id text,
  author_name text,
  author_username text,
  comment_text text not null,
  matched_trigger_id uuid references triggers(id) on delete set null,
  dm_sent boolean not null default false,
  reply_sent boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

-- Indexes for efficient lookups
create index if not exists idx_comment_logs_channel_id on comment_logs(channel_id);
create index if not exists idx_comment_logs_workspace_id on comment_logs(workspace_id);
create index if not exists idx_comment_logs_platform_comment_id on comment_logs(platform_comment_id);
create index if not exists idx_comment_logs_created_at on comment_logs(created_at desc);

-- Unique constraint to avoid processing the same comment twice
create unique index if not exists idx_comment_logs_unique_comment
  on comment_logs(channel_id, platform_comment_id);

-- RLS policies for comment_logs
alter table comment_logs enable row level security;

create policy "Users can view comment logs in their workspace"
  on comment_logs for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- ============================================================
-- 00005_sequences.sql
-- ============================================================
-- Sequences: drip campaigns
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequences_workspace" ON sequences
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id),
  current_step_index INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  next_step_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, contact_id)
);

ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments_via_sequence" ON sequence_enrollments
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM sequences WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 00006_workspace_invites.sql
-- ============================================================
-- ============================================================
-- WORKSPACE INVITES
-- ============================================================

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- Members of the workspace can view invites
CREATE POLICY "workspace_invites_select" ON workspace_invites
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only workspace owners can create invites
CREATE POLICY "workspace_invites_insert" ON workspace_invites
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Only workspace owners can delete invites
CREATE POLICY "workspace_invites_delete" ON workspace_invites
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Only workspace owners can update invite status
CREATE POLICY "workspace_invites_update" ON workspace_invites
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role = 'owner'
    )
    OR
    -- Allow the invited user to accept their own invite
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ============================================================
-- 00007_openai_api_key.sql
-- ============================================================
-- Add OpenAI API key column to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

-- ============================================================
-- 00008_ai_provider.sql
-- ============================================================
-- Rename openai_api_key to ai_api_key and add ai_provider column
ALTER TABLE workspaces RENAME COLUMN openai_api_key TO ai_api_key;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'openai';

-- ============================================================
-- 00009_fix_broadcast_rls.sql
-- ============================================================
-- Fix broadcast_recipients: add INSERT/UPDATE/DELETE policies
CREATE POLICY "Users can insert broadcast recipients" ON broadcast_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND is_workspace_member(b.workspace_id)
    )
  );

CREATE POLICY "Users can update broadcast recipients" ON broadcast_recipients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM broadcasts b
      WHERE b.id = broadcast_recipients.broadcast_id
        AND is_workspace_member(b.workspace_id)
    )
  );

-- Fix scheduled_jobs: add full CRUD policies for workspace members
-- Jobs are workspace-agnostic (system-level), so allow authenticated users
CREATE POLICY "Authenticated users can insert jobs" ON scheduled_jobs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read jobs" ON scheduled_jobs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update jobs" ON scheduled_jobs
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 00010_flow_versions.sql
-- ============================================================
-- Flow version history: stores a snapshot of nodes/edges on each publish
create table flow_versions (
  id uuid primary key default uuid_generate_v4(),
  flow_id uuid not null references flows(id) on delete cascade,
  version integer not null,
  nodes jsonb not null,
  edges jsonb not null,
  viewport jsonb,
  name text not null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (flow_id, version)
);

create index idx_flow_versions_flow on flow_versions(flow_id, version desc);

-- RLS
alter table flow_versions enable row level security;

create policy "flow_versions_select" on flow_versions for select
  using (exists (
    select 1 from flows f
    join workspace_members wm on wm.workspace_id = f.workspace_id
    where f.id = flow_versions.flow_id
      and wm.user_id = auth.uid()
  ));

create policy "flow_versions_insert" on flow_versions for insert
  with check (exists (
    select 1 from flows f
    join workspace_members wm on wm.workspace_id = f.workspace_id
    where f.id = flow_versions.flow_id
      and wm.user_id = auth.uid()
  ));

-- ============================================================
-- 00011_workspace_webhook_secret.sql
-- ============================================================
-- Add workspace-level webhook secret for Zernio HMAC signature verification.
-- Zernio exposes a single webhook per profile/API key, so the secret lives at the
-- workspace level (not per-channel). Used by /api/webhooks/late to verify signatures.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- ============================================================
-- 00012_webhook_events.sql
-- ============================================================
-- Idempotency ledger for inbound Zernio webhook deliveries. Zernio retries a
-- delivery with the same event id whenever our 200 doesn't arrive within its 5s
-- timeout; /api/webhooks/late claims the id here before processing so retries
-- and redeliveries never re-run a flow (which was double-sending DMs).
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rows are only needed for the retry window (hours); allow cheap pruning.
CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx ON webhook_events (received_at);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 00013_sequence_enrollments_channel_cascade.sql
-- ============================================================
-- sequence_enrollments.channel_id was declared without an ON DELETE action
-- (00005_sequences.sql), so deleting a channel with enrollments failed with a
-- 23503 FK violation. Every other channel FK cascades (or sets null); align
-- this one so channel deletion works.
ALTER TABLE sequence_enrollments
  DROP CONSTRAINT sequence_enrollments_channel_id_fkey,
  ADD CONSTRAINT sequence_enrollments_channel_id_fkey
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

-- ============================================================
-- 00014_scheduled_jobs_claimed_at.sql
-- ============================================================
-- The cron claims a job by flipping status to 'processing'. If that UPDATE
-- commits but the response is lost, the job is stranded: the fetch only read
-- 'pending' rows. claimed_at lets the cron reclaim 'processing' jobs whose
-- claim is older than a few minutes.
ALTER TABLE scheduled_jobs ADD COLUMN claimed_at timestamptz;

CREATE INDEX idx_scheduled_jobs_processing ON scheduled_jobs(claimed_at)
  WHERE status = 'processing';

-- ============================================================
-- 00015_backfill_claimed_at.sql
-- ============================================================
-- 00014 added claimed_at but did not backfill rows already stuck in
-- 'processing', and old-code invocations claim without stamping it. Stamp
-- existing NULL claims so the cron's staleness clock (claimed_at older than
-- 5 minutes) applies to them; genuinely stranded rows become reclaimable
-- shortly after this runs, while a claim still live at migration time gets
-- the full window to finish before being reclaimed.
UPDATE scheduled_jobs
SET claimed_at = now()
WHERE status = 'processing' AND claimed_at IS NULL;

-- ============================================================
-- 00016_security_hardening.sql
-- ============================================================
-- Security hardening for advisor warnings.
--
-- 1) Pin search_path on functions the linter flagged as mutable. Trigger and
--    RPC helpers reference public tables unqualified, so pin to `public`
--    (safe, no behavior change) rather than an empty path.
alter function update_updated_at() set search_path = public;
alter function is_workspace_member(uuid) set search_path = public;
alter function increment_unread(uuid, text) set search_path = public;
alter function increment_broadcast_sent(uuid) set search_path = public;
alter function increment_broadcast_failed(uuid) set search_path = public;

-- 2) handle_new_user is a signup trigger and must never be reachable over the
--    REST RPC surface. anon/authenticated inherit EXECUTE from PUBLIC, so revoke
--    from PUBLIC. The trigger runs as the table owner, so signup is unaffected.
--    is_workspace_member is intentionally left executable because RLS policies
--    evaluate it as the querying role. The increment_* helpers are invoked
--    server-side with the service role; their RPC exposure is accepted (they
--    only mutate counters within a workspace the caller can already access).
revoke execute on function handle_new_user() from public, anon, authenticated;

-- ============================================================
-- 00017_website_channel.sql
-- ============================================================
-- Website live-chat widget: allow a "website" channel platform.
--
-- The original channels.platform check (00001) only covered the social networks
-- reachable through Zernio. A website channel is served entirely by SpirChat's
-- own Supabase-backed inbox (no Zernio), so widen the constraint. whatsapp is
-- included to match the Platform type already used in the app.
alter table channels drop constraint channels_platform_check;

alter table channels add constraint channels_platform_check
  check (platform in (
    'facebook', 'instagram', 'twitter', 'telegram',
    'bluesky', 'reddit', 'whatsapp', 'website'
  ));

-- Website conversations are polled by created_at within a conversation; the
-- existing idx_messages_conversation (conversation_id, created_at) already
-- covers that access pattern, so no new index is required.

-- ============================================================
-- 00018_canned_responses.sql
-- ============================================================
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

-- ============================================================
-- 00019_widget_config.sql
-- ============================================================
-- Per-widget configuration for the website live-chat widget.
-- Holds the pre-chat form toggle and greeting (Chatwoot-style):
--   { "prechat": boolean, "greeting": string }
alter table channels
  add column if not exists widget_config jsonb not null default '{}'::jsonb;

-- ============================================================
-- 00020_conversation_notes.sql
-- ============================================================
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

-- ============================================================
-- 00021_conversation_labels.sql
-- ============================================================
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

-- ============================================================
-- 00022_widget_presence.sql
-- ============================================================
-- Website visitor presence (Tidio-style "online now" + current page).
-- Stored on the conversation; only website conversations set these.
alter table conversations
  add column if not exists visitor_last_seen_at timestamptz,
  add column if not exists visitor_current_page text;

-- ============================================================
-- 00023_widget_typing.sql
-- ============================================================
-- Website visitor "is typing" signal (Tidio-style). Set on each typing ping;
-- the inbox treats the visitor as typing only within a few seconds of it.
alter table conversations
  add column if not exists visitor_typing_at timestamptz;

-- ============================================================
-- 00024_business_hours.sql
-- ============================================================
-- Business hours + auto-reply (feature 14).
-- Stored per workspace as a single jsonb blob so no per-day tables are needed.
--
-- Shape:
-- {
--   "enabled": true,
--   "timezone": "Asia/Baghdad",
--   "days": {
--     "0": { "open": false },                       -- Sunday
--     "1": { "open": true, "from": "09:00", "to": "17:00" },
--     ...
--     "6": { "open": false }
--   },
--   "replyOffline": "We're closed right now — leave a message and we'll reply.",
--   "replyOnline": null
-- }

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- 00025_api_keys_webhooks.sql
-- ============================================================
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

-- ============================================================
-- 00026_push_subscriptions.sql
-- ============================================================
-- Web Push subscriptions for agents (feature 20).
-- Each row is one browser/device push endpoint owned by a workspace member.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index idx_push_subscriptions_workspace on push_subscriptions(workspace_id);
create index idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- Members can register/remove their own device subscriptions within a workspace
-- they belong to.
create policy "Users manage their own push subscriptions"
  on push_subscriptions for all
  using (user_id = auth.uid() and is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and is_workspace_member(workspace_id));

-- ============================================================
-- 00027_help_center.sql
-- ============================================================
-- Help Center / Knowledge Base (feature 16).
-- Public, searchable articles per workspace. Published articles are readable by
-- anyone (served via the service role on the public /help routes); editing is
-- restricted to workspace members.

create table kb_articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  slug text not null,
  category text,
  body text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index idx_kb_articles_workspace on kb_articles(workspace_id);
create index idx_kb_articles_published on kb_articles(workspace_id, is_published);

alter table kb_articles enable row level security;
create policy "Members manage KB articles in their workspaces"
  on kb_articles for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- 00028_routing_sla.sql
-- ============================================================
-- Auto-assignment + SLA (feature 13).
-- auto_assign: 'off' | 'round_robin' (least-loaded agent).
-- sla_minutes: first-response target; 0 disables the SLA indicator.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS auto_assign text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS sla_minutes integer NOT NULL DEFAULT 0;

-- ============================================================
-- 00029_rich_messages.sql
-- ============================================================
-- Rich message content: link buttons + product cards/carousels (feature 12).
-- Stored as jsonb on the message so website conversations can render tappable
-- buttons and card carousels alongside plain text.
--
-- Shape (buttons):
--   { "type": "buttons", "buttons": [ { "label": "Buy now", "url": "https://…" } ] }
-- Shape (cards):
--   { "type": "cards", "cards": [ { "title","subtitle","imageUrl","url",
--                                   "buttons":[{ "label","url" }] } ] }

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS rich_content jsonb;

-- ============================================================
-- 00030_forms.sql
-- ============================================================
-- Conversational forms (feature 5).
-- A form is a sequence of fields the widget asks one-by-one, storing answers as
-- a response linked to the visitor's conversation/contact.
--
-- forms.fields shape:
--   [ { "key": "email", "label": "What's your email?", "type": "email",
--       "required": true } ]

create table forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  fields jsonb not null default '[]'::jsonb,
  success_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_forms_workspace on forms(workspace_id);

alter table forms enable row level security;
create policy "Members manage forms in their workspaces"
  on forms for all
  using (is_workspace_member(workspace_id));

create table form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_form_responses_form on form_responses(form_id);
create index idx_form_responses_workspace on form_responses(workspace_id);

alter table form_responses enable row level security;
-- Reads for members; inserts come from the widget via the service role.
create policy "Members read form responses in their workspaces"
  on form_responses for select
  using (is_workspace_member(workspace_id));

-- ============================================================
-- 00031_campaigns.sql
-- ============================================================
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

-- ============================================================
-- 00032_integrations.sql
-- ============================================================
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

-- ============================================================
-- 00033_auto_reply_flag.sql
-- ============================================================
-- Race-safe offline auto-reply guard (review follow-up).
-- Set atomically the first time we post the business-hours offline auto-reply
-- into a conversation, so two near-simultaneous first messages can't both send.

alter table conversations
  add column if not exists auto_reply_sent_at timestamptz;

-- ============================================================
-- 00034_tracked_links.sql
-- ============================================================
-- Tracked links + click analytics (adapted from OpenReply, MIT).
-- A tracked link swaps a destination URL for a short /r/<slug> redirect that
-- records a click before forwarding, so campaigns and growth automations can
-- measure clicks and CTR.

create table tracked_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  slug text not null unique,
  label text,
  destination_url text not null,
  created_at timestamptz not null default now()
);

create index idx_tracked_links_workspace on tracked_links(workspace_id);
create index idx_tracked_links_campaign on tracked_links(campaign_id);

alter table tracked_links enable row level security;
create policy "Members manage tracked links in their workspaces"
  on tracked_links for all
  using (is_workspace_member(workspace_id));

create table link_clicks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tracked_link_id uuid not null references tracked_links(id) on delete cascade,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

create index idx_link_clicks_link on link_clicks(tracked_link_id);
create index idx_link_clicks_workspace_created on link_clicks(workspace_id, created_at);

alter table link_clicks enable row level security;
-- Members read click analytics; clicks are inserted by the public /r route via
-- the service role.
create policy "Members read link clicks in their workspaces"
  on link_clicks for select
  using (is_workspace_member(workspace_id));

-- ============================================================
-- 00035_comment_log_status.sql
-- ============================================================
-- Structured comment-automation outcomes + rate-limit visibility (Phase 2,
-- inspired by OpenReply's DmStatus / SKIPPED_RATE_LIMIT).
--
-- status values: 'processing' (claimed, race guard) | 'no_match' | 'sent'
--   | 'reply_only' | 'skipped_rate_limit' | 'failed'

alter table comment_logs
  add column if not exists status text;

-- ============================================================
-- 00036_meta_credentials.sql
-- ============================================================
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

-- ============================================================
-- 00037_report_shares.sql
-- ============================================================
-- Shareable public link/click reports (from OpenReply's shareable campaign
-- reports, MIT). A report_shares row exposes a workspace's tracked-link
-- analytics at a public /reports/<slug> URL (read-only, no auth).

create table report_shares (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  slug text not null unique,
  title text,
  created_at timestamptz not null default now()
);

create index idx_report_shares_workspace on report_shares(workspace_id);

alter table report_shares enable row level security;
create policy "Members manage report shares in their workspaces"
  on report_shares for all
  using (is_workspace_member(workspace_id));
-- Public reads happen via the service role on the /reports route.

-- ============================================================
-- 00038_dm_jobs_buttons.sql
-- ============================================================
-- Carry link buttons through the DM retry queue so a rate-limited retry resends
-- the exact button template (not degraded plain text).

alter table dm_jobs
  add column if not exists buttons jsonb;

-- ============================================================
-- 00039_segments.sql
-- ============================================================
-- Audience segments (concept adapted from Parcelvoy's rule engine, MIT).
-- A segment is a saved set of contact filters campaigns can target instead of
-- "all subscribed contacts".

create table segments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_segments_workspace on segments(workspace_id);

alter table segments enable row level security;
create policy "Members manage segments in their workspaces"
  on segments for all
  using (is_workspace_member(workspace_id));

-- Campaigns can target a segment.
alter table campaigns
  add column if not exists segment_id uuid references segments(id) on delete set null;

-- ============================================================
-- 00040_csat.sql
-- ============================================================
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

-- ============================================================
-- 00041_macros.sql
-- ============================================================
-- ============================================================
-- Macros — saved bundles of actions an agent runs on a conversation
-- in one click (concept borrowed from Chatwoot, MIT).
-- Each action is { type, value }; types: add_label, remove_label,
-- assign, send_message, set_status.
-- ============================================================
create table macros (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_macros_workspace on macros(workspace_id);

alter table macros enable row level security;
create policy "Members manage macros in their workspaces"
  on macros for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- 00042_campaign_schedule.sql
-- ============================================================
-- ============================================================
-- Scheduled campaigns. A campaign with status 'scheduled' and a
-- scheduled_at in the past is delivered by the daily jobs cron.
-- (status is free text: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed')
-- ============================================================
alter table campaigns
  add column if not exists scheduled_at timestamptz;

create index if not exists idx_campaigns_scheduled
  on campaigns(scheduled_at)
  where status = 'scheduled';

-- ============================================================
-- 00043_campaign_recipients.sql
-- ============================================================
-- ============================================================
-- Per-recipient delivery log for campaigns, so each campaign has a
-- real send report (who was reached, what failed and why).
-- ============================================================
create table campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  recipient text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index idx_campaign_recipients_campaign on campaign_recipients(campaign_id, created_at desc);

alter table campaign_recipients enable row level security;
create policy "Members view campaign recipients in their workspaces"
  on campaign_recipients for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- 00044_workspace_csat.sql
-- ============================================================
-- ============================================================
-- Per-workspace toggle: when on, resolving a conversation automatically
-- sends the contact a CSAT survey link.
-- ============================================================
alter table workspaces
  add column if not exists csat_enabled boolean not null default false;

-- ============================================================
-- 00045_sequence_tag_trigger.sql
-- ============================================================
-- ============================================================
-- Sequence auto-triggers: a sequence can name a tag that auto-enrolls a
-- contact when that tag is applied. Implemented as a trigger on
-- contact_tags so it fires no matter where the tag is added (inbox, bulk
-- action, flow node, import).
-- ============================================================
alter table sequences
  add column if not exists trigger_tag_id uuid references tags(id) on delete set null;

create index if not exists idx_sequences_trigger_tag
  on sequences(trigger_tag_id)
  where trigger_tag_id is not null;

create or replace function enroll_on_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seq record;
  first_step jsonb;
  next_at timestamptz;
  chan uuid;
begin
  for seq in
    select id, steps
    from sequences
    where trigger_tag_id = new.tag_id
      and status = 'active'
      and jsonb_array_length(coalesce(steps, '[]'::jsonb)) > 0
  loop
    -- The contact must have a conversation to be reachable on a channel.
    select channel_id into chan
    from conversations
    where contact_id = new.contact_id
    order by last_message_at desc nulls last
    limit 1;
    if chan is null then
      continue;
    end if;

    first_step := seq.steps->0;
    if first_step->>'type' = 'delay' and (first_step->>'delayMinutes') is not null then
      next_at := now() + ((first_step->>'delayMinutes')::int || ' minutes')::interval;
    else
      next_at := now();
    end if;

    insert into sequence_enrollments (sequence_id, contact_id, channel_id, next_step_at)
    values (seq.id, new.contact_id, chan, next_at)
    on conflict (sequence_id, contact_id) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_enroll_on_tag on contact_tags;
create trigger trg_enroll_on_tag
  after insert on contact_tags
  for each row execute function enroll_on_tag();

-- ============================================================
-- 00046_campaign_ab.sql
-- ============================================================
-- ============================================================
-- A/B campaigns: an optional second message variant. When body_b is set,
-- the audience is split ~50/50 and each recipient's variant is logged so
-- the campaign report can compare the two.
-- ============================================================
alter table campaigns
  add column if not exists body_b text;

alter table campaign_recipients
  add column if not exists variant text not null default 'a' check (variant in ('a', 'b'));

-- ============================================================
-- 00047_weekly_reports.sql
-- ============================================================
-- ============================================================
-- Weekly email reports. When weekly_report_email is set, the daily jobs
-- cron emails a workspace summary at most once every ~7 days (gated by
-- last_report_sent_at), so no dedicated weekly cron is needed.
-- ============================================================
alter table workspaces
  add column if not exists weekly_report_email text;

alter table workspaces
  add column if not exists last_report_sent_at timestamptz;

-- ============================================================
-- 00048_enroll_on_tag_safe.sql
-- ============================================================
-- ============================================================
-- Harden enroll_on_tag: a failure while auto-enrolling must never block the
-- tag insert itself. Wrap the per-sequence work in an exception guard and
-- validate delayMinutes before casting.
-- ============================================================
create or replace function enroll_on_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seq record;
  first_step jsonb;
  next_at timestamptz;
  chan uuid;
  mins text;
begin
  for seq in
    select id, steps
    from sequences
    where trigger_tag_id = new.tag_id
      and status = 'active'
      and jsonb_array_length(coalesce(steps, '[]'::jsonb)) > 0
  loop
    begin
      -- The contact must have a conversation to be reachable on a channel.
      select channel_id into chan
      from conversations
      where contact_id = new.contact_id
      order by last_message_at desc nulls last
      limit 1;
      if chan is null then
        continue;
      end if;

      first_step := seq.steps->0;
      mins := first_step->>'delayMinutes';
      if first_step->>'type' = 'delay' and mins ~ '^[0-9]+$' then
        next_at := now() + ((mins)::int || ' minutes')::interval;
      else
        next_at := now();
      end if;

      insert into sequence_enrollments (sequence_id, contact_id, channel_id, next_step_at)
      values (seq.id, new.contact_id, chan, next_at)
      on conflict (sequence_id, contact_id) do nothing;
    exception when others then
      -- Never let an enrollment problem fail the tag insert.
      null;
    end;
  end loop;
  return new;
end;
$$;

-- ============================================================
-- 00049_label_rules.sql
-- ============================================================
-- ============================================================
-- Auto-labeling: when an inbound message contains a rule's keyword, the
-- matching label is applied to its conversation.
-- ============================================================
create table label_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  keyword text not null,
  label_id uuid not null references labels(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_label_rules_workspace on label_rules(workspace_id);

alter table label_rules enable row level security;
create policy "Members manage label rules in their workspaces"
  on label_rules for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- 00050_snooze_until.sql
-- ============================================================
-- ============================================================
-- Timed snooze: a snoozed conversation with snooze_until in the past is
-- reopened automatically by the daily jobs cron.
-- ============================================================
alter table conversations
  add column if not exists snooze_until timestamptz;

create index if not exists idx_conversations_snooze
  on conversations(snooze_until)
  where status = 'snoozed' and snooze_until is not null;

-- ============================================================
-- 00051_sla_escalation.sql
-- ============================================================
-- ============================================================
-- SLA escalation bookkeeping: stamp when a breached conversation was
-- escalated so the cron notifies at most once per breach.
-- ============================================================
alter table conversations
  add column if not exists sla_escalated_at timestamptz;

-- ============================================================
-- 00052_merge_contacts.sql
-- ============================================================
-- ============================================================
-- Merge one contact (dup) into another (primary): move all references,
-- fill the primary's empty fields, then delete the duplicate. Runs in a
-- single transaction. Both contacts must be in the given workspace.
-- ============================================================
create or replace function merge_contacts(p_primary uuid, p_dup uuid, p_ws uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_primary = p_dup then
    raise exception 'cannot merge a contact into itself';
  end if;
  if not exists (select 1 from contacts where id = p_primary and workspace_id = p_ws) then
    raise exception 'primary contact not in workspace';
  end if;
  if not exists (select 1 from contacts where id = p_dup and workspace_id = p_ws) then
    raise exception 'duplicate contact not in workspace';
  end if;

  -- Tags: keep the union.
  insert into contact_tags (contact_id, tag_id, created_at)
    select p_primary, tag_id, created_at from contact_tags where contact_id = p_dup
    on conflict (contact_id, tag_id) do nothing;
  delete from contact_tags where contact_id = p_dup;

  -- Custom fields: primary's values win; add any the primary is missing.
  insert into contact_custom_fields (contact_id, field_id, value, updated_at)
    select p_primary, field_id, value, updated_at from contact_custom_fields where contact_id = p_dup
    on conflict (contact_id, field_id) do nothing;
  delete from contact_custom_fields where contact_id = p_dup;

  -- Conversations: fold dup's messages into the primary's conversation on the
  -- same channel, drop the now-empty conflicting dup conversation, then move
  -- the rest over.
  update messages m set conversation_id = pc.id
    from conversations dc, conversations pc
    where m.conversation_id = dc.id and dc.contact_id = p_dup
      and pc.contact_id = p_primary and pc.channel_id = dc.channel_id;
  delete from conversations dc using conversations pc
    where dc.contact_id = p_dup and pc.contact_id = p_primary and pc.channel_id = dc.channel_id;
  update conversations set contact_id = p_primary where contact_id = p_dup;

  -- Sequence enrollments: keep the union (unique per sequence+contact).
  insert into sequence_enrollments (sequence_id, contact_id, channel_id, current_step_index, status, enrolled_at, next_step_at, completed_at)
    select sequence_id, p_primary, channel_id, current_step_index, status, enrolled_at, next_step_at, completed_at
    from sequence_enrollments where contact_id = p_dup
    on conflict (sequence_id, contact_id) do nothing;
  delete from sequence_enrollments where contact_id = p_dup;

  -- Straightforward reassignments (no per-contact uniqueness).
  update contact_channels set contact_id = p_primary where contact_id = p_dup;
  update flow_sessions set contact_id = p_primary where contact_id = p_dup;
  update broadcast_recipients set contact_id = p_primary where contact_id = p_dup;
  update analytics_events set contact_id = p_primary where contact_id = p_dup;
  update form_responses set contact_id = p_primary where contact_id = p_dup;
  update csat_surveys set contact_id = p_primary where contact_id = p_dup;
  update campaign_recipients set contact_id = p_primary where contact_id = p_dup;

  -- Fill the primary's empty scalar fields from the duplicate.
  update contacts p set
    email = coalesce(p.email, d.email),
    phone = coalesce(p.phone, d.phone),
    display_name = coalesce(p.display_name, d.display_name),
    avatar_url = coalesce(p.avatar_url, d.avatar_url),
    is_subscribed = p.is_subscribed and d.is_subscribed,
    last_interaction_at = greatest(p.last_interaction_at, d.last_interaction_at)
    from contacts d where p.id = p_primary and d.id = p_dup;

  delete from contacts where id = p_dup;
end;
$$;

-- ============================================================
-- 00053_inbox_views.sql
-- ============================================================
-- ============================================================
-- Saved inbox views: a named combination of inbox filters, shared across
-- the workspace.
-- ============================================================
create table inbox_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_inbox_views_workspace on inbox_views(workspace_id, created_at);

alter table inbox_views enable row level security;
create policy "Members manage inbox views in their workspaces"
  on inbox_views for all
  using (is_workspace_member(workspace_id));

-- ============================================================
-- 00054_ai_replies.sql
-- ============================================================
-- ============================================================
-- AI auto-reply: when on, a website visitor's message is answered from the
-- workspace's published Help Center articles (if the model is confident),
-- as long as the conversation is unassigned and automation isn't paused.
-- ============================================================
alter table workspaces
  add column if not exists ai_replies_enabled boolean not null default false;

-- ============================================================
-- 00055_agent_cap.sql
-- ============================================================
-- ============================================================
-- Round-robin auto-assign respects a per-agent open-conversation cap.
-- 0 means no cap.
-- ============================================================
alter table workspaces
  add column if not exists agent_conversation_cap integer not null default 0;

-- ============================================================
-- 00056_visitor_followup.sql
-- ============================================================
-- ============================================================
-- Visitor follow-up: if a website visitor goes quiet after being replied to,
-- the daily jobs cron sends one follow-up nudge (once per idle period).
-- ============================================================
alter table workspaces
  add column if not exists visitor_followup_minutes integer not null default 0;
alter table workspaces
  add column if not exists visitor_followup_message text;

alter table conversations
  add column if not exists followup_sent_at timestamptz;

-- ============================================================
-- 00057_erase_contact.sql
-- ============================================================
-- ============================================================
-- GDPR "right to erasure": permanently and irreversibly delete a contact
-- and every row that references them — conversations, messages, survey
-- responses, campaign/sequence history, custom fields, analytics. Unlike a
-- plain contact delete (which may rely on FK cascades or leave orphaned
-- messages), this removes all personal data in one transaction so nothing
-- traceable to the person remains.
-- ============================================================
create or replace function erase_contact(p_contact uuid, p_ws uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from contacts where id = p_contact and workspace_id = p_ws) then
    raise exception 'contact not in workspace';
  end if;

  -- Messages belonging to the contact's conversations, then the conversations.
  delete from messages m using conversations c
    where m.conversation_id = c.id and c.contact_id = p_contact;
  delete from conversations where contact_id = p_contact;

  -- Everything else that points at the contact.
  delete from contact_tags where contact_id = p_contact;
  delete from contact_custom_fields where contact_id = p_contact;
  delete from contact_channels where contact_id = p_contact;
  delete from sequence_enrollments where contact_id = p_contact;
  delete from flow_sessions where contact_id = p_contact;
  delete from broadcast_recipients where contact_id = p_contact;
  delete from analytics_events where contact_id = p_contact;
  delete from form_responses where contact_id = p_contact;
  delete from csat_surveys where contact_id = p_contact;
  delete from campaign_recipients where contact_id = p_contact;

  -- Finally the contact record itself.
  delete from contacts where id = p_contact;
end;
$$;
