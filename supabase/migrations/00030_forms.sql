-- Conversational forms (feature 5).
-- A form is a sequence of fields the widget asks one-by-one, storing answers as
-- a response linked to the visitor's conversation/contact.
--
-- forms.fields shape:
--   [ { "key": "email", "label": "What's your email?", "type": "email",
--       "required": true } ]

create table forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  fields jsonb not null default '[]'::jsonb,
  success_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_forms_workspace on forms(workspace_id);

alter table forms enable row level security;
create policy "Members manage forms in their workspaces"
  on forms for all
  using (is_workspace_member(workspace_id));

create table form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_form_responses_form on form_responses(form_id);
create index idx_form_responses_workspace on form_responses(workspace_id);

alter table form_responses enable row level security;
-- Reads for members; inserts come from the widget via the service role.
create policy "Members read form responses in their workspaces"
  on form_responses for select
  using (is_workspace_member(workspace_id));
