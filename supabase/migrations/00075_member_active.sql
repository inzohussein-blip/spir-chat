-- 00075_member_active.sql
-- Enable/disable (open/close) a team member's access to the workspace. A member
-- can close their own account; an owner/admin can close a member's. A closed
-- member is blocked from the workspace until reactivated. deactivated_by records
-- who closed it, so a member can reopen only what they closed themselves.

alter table workspace_members
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_by uuid;
