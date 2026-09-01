-- ============================================================
-- Audit log: an append-only record of consequential workspace actions
-- (member changes, data erasure, campaign sends, settings changes) for
-- accountability. Written server-side via the service role; members can read
-- their own workspace's log but never modify it.
-- ============================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- The user who performed the action (null for automated/system actions).
  actor_id uuid references auth.users(id) on delete set null,
  -- A short label of who acted, captured at write time so the log stays
  -- readable even after the user is removed.
  actor_label text,
  -- Machine-readable action key, e.g. "contact.erased", "member.removed".
  action text not null,
  -- Human-readable description of the target, e.g. a contact/campaign name.
  target_label text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_workspace on audit_log(workspace_id, created_at desc);

alter table audit_log enable row level security;
-- Read-only for members; inserts happen through the service role only.
create policy "Members read their workspace audit log"
  on audit_log for select
  using (is_workspace_member(workspace_id));
