-- Help Center / Knowledge Base (feature 16).
-- Public, searchable articles per workspace. Published articles are readable by
-- anyone (served via the service role on the public /help routes); editing is
-- restricted to workspace members.

create table kb_articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  slug text not null,
  category text,
  body text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index idx_kb_articles_workspace on kb_articles(workspace_id);
create index idx_kb_articles_published on kb_articles(workspace_id, is_published);

alter table kb_articles enable row level security;
create policy "Members manage KB articles in their workspaces"
  on kb_articles for all
  using (is_workspace_member(workspace_id));
