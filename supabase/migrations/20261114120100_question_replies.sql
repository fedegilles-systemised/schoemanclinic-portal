-- Ask the clinic (knowledge base questions 14 and 22, decided 11 November 2026). A patient, or a guardian
-- who can act, asks a question in the portal; the team reply in Clinic Hub; replies show in the portal
-- with a status. The page says it is not for emergencies. A conversation goes back and forth in replies.

create table public.question_replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  from_clinic boolean not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
comment on table public.question_replies is 'The messages after a question: from the team (from_clinic) or from the patient or guardian.';
create index question_replies_question_idx on public.question_replies (question_id, created_at);
create index question_replies_author_idx on public.question_replies (author_id);

create trigger question_replies_write_audit_log after insert or update or delete on public.question_replies
  for each row execute function private.write_audit_log();

alter table public.question_replies enable row level security;
alter table public.question_replies force row level security;
revoke all on table public.question_replies from public, anon, authenticated;
revoke delete, truncate on public.question_replies from service_role;
grant select on public.question_replies to authenticated;

create policy "The patient side and staff in scope read replies" on public.question_replies
  for select to authenticated
  using (exists (
    select 1 from public.questions q
    where q.id = question_id
      and (q.patient_id in (select private.my_patient_ids()) or private.in_scope(q.patient_id))
  ));

-- Replying: staff who can open the patient answer (the question is then answered); the patient or a
-- guardian who can act writes back (the question then waits for the clinic again). Closed stays closed.
create function private.reply_to_question(_question uuid, _body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.questions;
  staff boolean;
  reply uuid;
begin
  select * into q from public.questions where id = _question for update;
  if not found then
    raise exception 'That question was not found.' using errcode = '22023';
  end if;
  staff := private.in_scope(q.patient_id);
  if not staff and not private.can_act_for(q.patient_id) then
    raise exception 'You cannot reply to this question.' using errcode = '42501';
  end if;
  if q.status = 'closed' then
    raise exception 'This conversation is closed. Please ask a new question.' using errcode = '22023';
  end if;
  if _body is null or char_length(btrim(_body)) not between 1 and 4000 then
    raise exception 'Write a reply of up to 4,000 characters.' using errcode = '22023';
  end if;
  insert into public.question_replies (question_id, author_id, from_clinic, body)
  values (_question, (select auth.uid()), staff, btrim(_body))
  returning id into reply;
  update public.questions
  set status = case when staff then 'answered'::public.question_status else 'awaiting_reply'::public.question_status end,
      answered_at = case when staff then now() else answered_at end
  where id = _question;
  return reply;
end;
$$;
comment on function private.reply_to_question(uuid, text) is 'Adds a reply: from staff in scope (answered) or the patient side (awaiting the clinic).';

-- Closing: staff who can open the patient.
create function private.close_question(_question uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.questions;
begin
  select * into q from public.questions where id = _question for update;
  if not found or not private.in_scope(q.patient_id) then
    raise exception 'You cannot close this question.' using errcode = '42501';
  end if;
  update public.questions set status = 'closed' where id = _question;
end;
$$;

create function public.reply_to_question(_question uuid, _body text)
returns uuid language sql security invoker set search_path = '' as $$ select private.reply_to_question(_question, _body); $$;
create function public.close_question(_question uuid)
returns void language sql security invoker set search_path = '' as $$ select private.close_question(_question); $$;

revoke all on function private.reply_to_question(uuid, text), private.close_question(uuid), public.reply_to_question(uuid, text), public.close_question(uuid) from public, anon, authenticated;
grant execute on function private.reply_to_question(uuid, text), private.close_question(uuid), public.reply_to_question(uuid, text), public.close_question(uuid) to authenticated;
