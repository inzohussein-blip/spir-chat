-- 00078_enforce_member_active.sql
-- Closing a member's account (00075, is_active = false) was only enforced by
-- the app redirecting to /suspended. RLS still treated them as a member, so
-- with their session they could keep reading and writing the workspace's data
-- straight through the Supabase API and keep receiving Realtime events.
-- Make is_workspace_member require an active membership, and move the policies
-- that queried workspace_members inline onto it. (Owner-only policies are left
-- as is: owners can't be deactivated. A member can still read their own
-- workspace_members rows, so the app can route them to /suspended.)

create or replace function is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid() and is_active
  );
$$;

drop policy if exists "Users can view comment logs in their workspace" on comment_logs;
create policy "Users can view comment logs in their workspace"
  on comment_logs for select
  using (is_workspace_member(workspace_id));

drop policy if exists "sequences_workspace" on sequences;
create policy "sequences_workspace"
  on sequences for all
  using (is_workspace_member(workspace_id));

drop policy if exists "enrollments_via_sequence" on sequence_enrollments;
create policy "enrollments_via_sequence"
  on sequence_enrollments for all
  using (
    exists (
      select 1 from sequences s
      where s.id = sequence_enrollments.sequence_id
        and is_workspace_member(s.workspace_id)
    )
  );

drop policy if exists "flow_versions_select" on flow_versions;
create policy "flow_versions_select"
  on flow_versions for select
  using (
    exists (
      select 1 from flows f
      where f.id = flow_versions.flow_id
        and is_workspace_member(f.workspace_id)
    )
  );

drop policy if exists "flow_versions_insert" on flow_versions;
create policy "flow_versions_insert"
  on flow_versions for insert
  with check (
    exists (
      select 1 from flows f
      where f.id = flow_versions.flow_id
        and is_workspace_member(f.workspace_id)
    )
  );

drop policy if exists "workspace_invites_select" on workspace_invites;
create policy "workspace_invites_select"
  on workspace_invites for select
  using (is_workspace_member(workspace_id));
