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
