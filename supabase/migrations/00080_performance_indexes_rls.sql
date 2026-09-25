-- 00080_performance_indexes_rls.sql
-- Performance, from the Supabase performance advisor. No behavior change.
--
-- 1. Index every foreign key that had no covering index (36). Without one,
--    joins on the key and every ON DELETE CASCADE / SET NULL from the parent
--    (deleting a contact, user, flow…) scan the whole child table.
create index if not exists idx_analytics_events_contact_id on analytics_events(contact_id);
create index if not exists idx_api_keys_created_by on api_keys(created_by);
create index if not exists idx_audit_log_actor_id on audit_log(actor_id);
create index if not exists idx_broadcast_recipients_channel_id on broadcast_recipients(channel_id);
create index if not exists idx_broadcast_recipients_contact_id on broadcast_recipients(contact_id);
create index if not exists idx_campaign_recipients_contact_id on campaign_recipients(contact_id);
create index if not exists idx_campaign_recipients_workspace_id on campaign_recipients(workspace_id);
create index if not exists idx_campaigns_created_by on campaigns(created_by);
create index if not exists idx_campaigns_segment_id on campaigns(segment_id);
create index if not exists idx_comment_logs_matched_trigger_id on comment_logs(matched_trigger_id);
create index if not exists idx_contact_custom_fields_field_id on contact_custom_fields(field_id);
create index if not exists idx_contact_notes_author_id on contact_notes(author_id);
create index if not exists idx_contact_notes_workspace_id on contact_notes(workspace_id);
create index if not exists idx_contact_tags_tag_id on contact_tags(tag_id);
create index if not exists idx_conversation_labels_label_id on conversation_labels(label_id);
create index if not exists idx_conversation_notes_author_id on conversation_notes(author_id);
create index if not exists idx_conversation_notes_workspace_id on conversation_notes(workspace_id);
create index if not exists idx_conversations_assigned_to on conversations(assigned_to);
create index if not exists idx_conversations_contact_id on conversations(contact_id);
create index if not exists idx_csat_surveys_contact_id on csat_surveys(contact_id);
create index if not exists idx_dm_jobs_workspace_id on dm_jobs(workspace_id);
create index if not exists idx_flow_sessions_channel_id on flow_sessions(channel_id);
create index if not exists idx_flow_sessions_flow_id on flow_sessions(flow_id);
create index if not exists idx_flow_versions_published_by on flow_versions(published_by);
create index if not exists idx_form_responses_contact_id on form_responses(contact_id);
create index if not exists idx_form_responses_conversation_id on form_responses(conversation_id);
create index if not exists idx_label_rules_label_id on label_rules(label_id);
create index if not exists idx_messages_sent_by_flow_id on messages(sent_by_flow_id);
create index if not exists idx_messages_sent_by_user_id on messages(sent_by_user_id);
create index if not exists idx_outreach_batches_created_by on outreach_batches(created_by);
create index if not exists idx_outreach_recipients_contact_id on outreach_recipients(contact_id);
create index if not exists idx_outreach_recipients_workspace_id on outreach_recipients(workspace_id);
create index if not exists idx_sequence_enrollments_channel_id on sequence_enrollments(channel_id);
create index if not exists idx_sequence_enrollments_contact_id on sequence_enrollments(contact_id);
create index if not exists idx_sequences_workspace_id on sequences(workspace_id);
create index if not exists idx_workspace_invites_invited_by on workspace_invites(invited_by);

-- 2. Wrap auth.uid() in a scalar subquery in the policies that called it
--    directly, so Postgres evaluates it once per statement instead of once per
--    row (lint 0003 auth_rls_initplan). Same predicates as before.
drop policy if exists "Members can view their workspace memberships" on workspace_members;
create policy "Members can view their workspace memberships"
  on workspace_members for select
  using (user_id = (select auth.uid()));

drop policy if exists "Owners can insert members" on workspace_members;
create policy "Owners can insert members"
  on workspace_members for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = 'owner'
    )
  );

drop policy if exists "Owners can update members" on workspace_members;
create policy "Owners can update members"
  on workspace_members for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = 'owner'
    )
  );

drop policy if exists "Owners can delete members" on workspace_members;
create policy "Owners can delete members"
  on workspace_members for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = 'owner'
    )
  );

drop policy if exists "workspace_invites_insert" on workspace_invites;
create policy "workspace_invites_insert"
  on workspace_invites for insert
  with check (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = (select auth.uid()) and role = 'owner'
    )
  );

drop policy if exists "workspace_invites_delete" on workspace_invites;
create policy "workspace_invites_delete"
  on workspace_invites for delete
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where user_id = (select auth.uid()) and role = 'owner'
    )
  );

drop policy if exists "Users manage their own push subscriptions" on push_subscriptions;
create policy "Users manage their own push subscriptions"
  on push_subscriptions for all
  using (user_id = (select auth.uid()) and is_workspace_member(workspace_id))
  with check (user_id = (select auth.uid()) and is_workspace_member(workspace_id));
