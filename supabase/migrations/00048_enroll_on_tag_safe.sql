-- ============================================================
-- Harden enroll_on_tag: a failure while auto-enrolling must never block the
-- tag insert itself. Wrap the per-sequence work in an exception guard and
-- validate delayMinutes before casting.
-- ============================================================
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
  mins text;
begin
  for seq in
    select id, steps
    from sequences
    where trigger_tag_id = new.tag_id
      and status = 'active'
      and jsonb_array_length(coalesce(steps, '[]'::jsonb)) > 0
  loop
    begin
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
      mins := first_step->>'delayMinutes';
      if first_step->>'type' = 'delay' and mins ~ '^[0-9]+$' then
        next_at := now() + ((mins)::int || ' minutes')::interval;
      else
        next_at := now();
      end if;

      insert into sequence_enrollments (sequence_id, contact_id, channel_id, next_step_at)
      values (seq.id, new.contact_id, chan, next_at)
      on conflict (sequence_id, contact_id) do nothing;
    exception when others then
      -- Never let an enrollment problem fail the tag insert.
      null;
    end;
  end loop;
  return new;
end;
$$;
