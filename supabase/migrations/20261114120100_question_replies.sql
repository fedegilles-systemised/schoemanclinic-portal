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
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.questions;
  staff boolean;
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
  values (_question, (select auth.uid()), staff, btrim(_body));
  update public.questions
  set status = case when staff then 'answered'::public.question_status else 'awaiting_reply'::public.question_status end,
      answered_at = case when staff then now() else answered_at end
  where id = _question;
  return staff;
end;
$$;
comment on function private.reply_to_question(uuid, text) is 'Adds a reply: from staff in scope (answered) or the patient side (awaiting the clinic). Returns true when the reply is from the clinic.';

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
returns boolean language sql security invoker set search_path = '' as $$ select private.reply_to_question(_question, _body); $$;
create function public.close_question(_question uuid)
returns void language sql security invoker set search_path = '' as $$ select private.close_question(_question); $$;

revoke all on function private.reply_to_question(uuid, text), private.close_question(uuid), public.reply_to_question(uuid, text), public.close_question(uuid) from public, anon, authenticated;
grant execute on function private.reply_to_question(uuid, text), private.close_question(uuid), public.reply_to_question(uuid, text), public.close_question(uuid) to authenticated;

-- Status and answered_at now change only through reply_to_question and close_question, so staff
-- cannot reopen a closed question or mark one answered directly.
drop policy "The team changes question status" on public.questions;
revoke update on public.questions from authenticated;

-- Opening a patient's document is written to the activity log like opening the record.
CREATE OR REPLACE FUNCTION private.log_record_view(_patient uuid, _entity text, _entity_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  actor uuid := (select auth.uid());
  role_held public.app_role;
  target uuid := coalesce(_entity_id, _patient);
begin
  if actor is null or not private.in_scope(_patient) then
    raise exception 'You cannot open this record.' using errcode = '42501';
  end if;
  if _entity is null or _entity not in ('patient_profiles', 'lab_reports', 'documents') then
    raise exception 'That record cannot be logged.' using errcode = '22023';
  end if;
  -- The record named must exist and belong to this patient, so the log cannot be filled with made-up
  -- ids or point one patient's record at another patient.
  if _entity = 'patient_profiles' and _entity_id is not null and _entity_id <> _patient then
    raise exception 'That record does not belong to this patient.' using errcode = '22023';
  end if;
  if _entity = 'documents' and (
    _entity_id is null
    or not exists (select 1 from public.documents d where d.id = _entity_id and d.patient_id = _patient)
  ) then
    raise exception 'That record does not belong to this patient.' using errcode = '22023';
  end if;
  if _entity = 'lab_reports' and (
    _entity_id is null
    or not exists (select 1 from public.lab_reports l where l.id = _entity_id and l.patient_id = _patient)
  ) then
    raise exception 'That record does not belong to this patient.' using errcode = '22023';
  end if;

  select r.role into role_held
  from public.user_roles r
  where r.user_id = actor and r.role in ('doctor', 'nurse', 'pa', 'health_coach', 'admin')
  order by array_position(array['doctor', 'nurse', 'pa', 'health_coach', 'admin']::public.app_role[], r.role)
  limit 1;

  if exists (
    select 1 from public.audit_log a
    where a.actor_id = actor and a.action = 'viewed' and a.entity = _entity and a.entity_id = target
      and a.created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, metadata)
  values (actor, role_held, 'viewed', _entity, target, jsonb_build_object('patient_id', _patient));
end;
$$;
