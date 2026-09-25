-- 00079_close_cross_tenant_policies.sql
-- Two policies let a signed-in user reach other workspaces' data.
--
-- 1. scheduled_jobs (00009) allowed ANY authenticated user to read, insert and
--    update every job. The table has no workspace_id; payloads carry message
--    text and conversation ids, and the jobs cron executes whatever is queued
--    with the service role — so a user could queue a scheduled_message into
--    another tenant's conversation. Jobs are now server-only: no policies, so
--    only the service role (cron, webhooks, server actions) can touch them.
--
-- 2. workspace_invites_update let the invited user update their own invite with
--    no WITH CHECK, i.e. rewrite workspace_id and role, and acceptInvite trusts
--    those columns (join ANY workspace as owner). It only failed by accident:
--    the email branch reads auth.users, which `authenticated` can't select.
--    Updates are now owner-only and the row must stay in a workspace they own;
--    acceptance already runs through the service role.

drop policy if exists "Authenticated users can insert jobs" on scheduled_jobs;
drop policy if exists "Authenticated users can read jobs" on scheduled_jobs;
drop policy if exists "Authenticated users can update jobs" on scheduled_jobs;

drop policy if exists "workspace_invites_update" on workspace_invites;
create policy "workspace_invites_update"
  on workspace_invites for update
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = (select auth.uid()) and role = 'owner' and is_active
    )
  )
  with check (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = (select auth.uid()) and role = 'owner' and is_active
    )
  );
