-- 00081_drop_redundant_select_policies.sql
-- Each of these tables had a "view" (FOR SELECT) policy next to a "manage"
-- (FOR ALL) policy with the same predicate, so every read evaluated the check
-- twice (lint 0006 multiple_permissive_policies). Permissive policies are OR'd
-- and FOR ALL already covers SELECT, so dropping the SELECT copies changes no
-- access. (contact_custom_fields' view policy was a narrower form of the manage
-- predicate, so the union is still exactly the manage predicate.)

drop policy if exists "Users can view broadcasts in their workspaces" on broadcasts;
drop policy if exists "Users can view channels in their workspaces" on channels;
drop policy if exists "Users can view contact channels via contact" on contact_channels;
drop policy if exists "Users can view contact custom fields" on contact_custom_fields;
drop policy if exists "Users can view contact tags" on contact_tags;
drop policy if exists "Users can view contacts in their workspaces" on contacts;
drop policy if exists "Users can view conversations in their workspaces" on conversations;
drop policy if exists "Users can view custom fields in their workspaces" on custom_field_definitions;
drop policy if exists "Users can view flows in their workspaces" on flows;
drop policy if exists "Users can view tags in their workspaces" on tags;
drop policy if exists "Users can view triggers via flow" on triggers;
