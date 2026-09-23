-- 00077_restrict_internal_rpcs.sql
-- These SECURITY DEFINER functions are internal: the increment_* counters are
-- only called server-side with the service role (webhooks, widget API, jobs
-- cron), and enroll_on_tag is a trigger function. Left executable by anon and
-- authenticated, anyone holding the public anon key could call
-- /rest/v1/rpc/increment_unread to rewrite any conversation's unread count and
-- last-message preview. Restrict them to the service role.
-- (is_workspace_member stays callable: RLS policies evaluate it as the caller.)

revoke execute on function increment_unread(uuid, text) from public, anon, authenticated;
revoke execute on function increment_broadcast_sent(uuid) from public, anon, authenticated;
revoke execute on function increment_broadcast_failed(uuid) from public, anon, authenticated;
revoke execute on function enroll_on_tag() from public, anon, authenticated;

grant execute on function increment_unread(uuid, text) to service_role;
grant execute on function increment_broadcast_sent(uuid) to service_role;
grant execute on function increment_broadcast_failed(uuid) to service_role;
