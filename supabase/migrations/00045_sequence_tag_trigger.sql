-- ============================================================
-- Sequence auto-triggers: a sequence can name a tag that auto-enrolls a
-- contact when that tag is applied. Implemented as a trigger on
-- contact_tags so it fires no matter where the tag is added (inbox, bulk
-- action, flow node, import).
-- ============================================================
alter table sequences
  add column if not exists trigger_tag_id uuid references tags(id) on delete set null;

create index if not exists idx_sequences_trigger_tag
  on sequences(trigger_tag_id)
  where trigger_tag_id is not null;

create or replace function enroll_on_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seq record;
  first_step jsonb;
  next_at timestamptz;
  chan uuid;
begin
  for seq in
    select id, steps
    from sequences
    where trigger_tag_id = new.tag_id
      and status = 'active'
      and jsonb_array_length(coalesce(steps, '[]'::jsonb)) > 0
  loop
    -- The contact must have a conversation to be reachable on a channel.
    select channel_id into chan
    from conversations
    where contact_id = new.contact_id
    order by last_message_at desc nulls last
    limit 1;
    if chan is null then
      continue;
    end if;

    first_step := seq.steps->0;
    if first_step->>'type' = 'delay' and (first_step->>'delayMinutes') is not null then
      next_at := now() + ((first_step->>'delayMinutes')::int || ' minutes')::interval;
    else
      next_at := now();
    end if;

    insert into sequence_enrollments (sequence_id, contact_id, channel_id, next_step_at)
    values (seq.id, new.contact_id, chan, next_at)
    on conflict (sequence_id, contact_id) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_enroll_on_tag on contact_tags;
create trigger trg_enroll_on_tag
  after insert on contact_tags
  for each row execute function enroll_on_tag();
