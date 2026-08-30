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
