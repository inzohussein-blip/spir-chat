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
