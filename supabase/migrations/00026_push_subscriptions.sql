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
