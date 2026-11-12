-- Every form a patient submits, kept on their record, and patient feedback with green, amber and red
-- routing (Dr Schoeman's CQC email of 8 November 2026, point 1; decided with George on 12 November
-- 2026 to build it in Clinic Hub rather than GoHighLevel).
--
-- 1. Forms. form_submissions holds a permanent copy of each form as the patient saw it: the
--    questions in words and the answers given, who submitted it and when. Repeat prescription
--    requests, questions to the clinic and feedback are copied in as they are made, and the ones
--    made before this migration are copied in once below. Nothing changes or removes a copy.
-- 2. Feedback. The day after an appointment (completed, or booked or confirmed and over), the
--    daily job asks the patient for feedback (at most once every 90 days), with one reminder after three days. A patient, or a
--    guardian who can act, answers in the portal. A score of 9 or 10 is green, 7 or 8 amber, and 0
--    to 6, or asking to be contacted, is red. Everyone is offered the Google review link: who is
--    asked never depends on the answer. Amber and red alert admins and PAs (red also the patient's
--    doctors) with a follow-up due within two working days or the same working day; the follow-up
--    is recorded and permanent. Feedback is read by admins, PAs and the patient's doctors, not by
--    nurses or health coaches, because it may be about them.

-- Shared ---------------------------------------------------------------------------------------

create type public.form_kind as enum ('feedback', 'repeat_request', 'question');

-- Refuses any change to a permanent record, for every role.
create function private.reject_permanent_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'This record is permanent and cannot be changed or removed.' using errcode = '42501';
end;
$$;

-- The first working day (Monday to Friday) on or after a date. Bank holidays are not counted.
create function private.working_day_from(_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case extract(isodow from _day)::int when 6 then _day + 2 when 7 then _day + 1 else _day end;
$$;

-- Who may read feedback about a patient: admins, PAs, and doctors on the patient's care team.
create function private.can_read_feedback(_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.in_scope(_patient)
    and (private.has_role('admin') or private.has_role('pa') or private.has_role('doctor'));
$$;

-- 1. Forms ---------------------------------------------------------------------------------------

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  kind public.form_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  -- [{"question": "...", "answer": "..."}], in the order asked.
  answers jsonb not null check (
    jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) between 1 and 60 and pg_column_size(answers) <= 65536
  ),
  source_id uuid not null,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint form_submissions_source_unique unique (kind, source_id)
);
comment on table public.form_submissions is 'A permanent copy of every form a patient or guardian submits: the questions as asked and the answers. Never changed.';
comment on column public.form_submissions.source_id is 'The row the form made: the repeat request, question or feedback.';
create index form_submissions_patient_idx on public.form_submissions (patient_id, submitted_at desc);
create index form_submissions_submitted_by_idx on public.form_submissions (submitted_by);

create trigger form_submissions_write_audit_log after insert or update or delete on public.form_submissions
  for each row execute function private.write_audit_log();
create trigger form_submissions_permanent before update or delete on public.form_submissions
  for each row execute function private.reject_permanent_change();
create trigger form_submissions_no_truncate before truncate on public.form_submissions
  for each statement execute function private.reject_permanent_change();

alter table public.form_submissions enable row level security;
alter table public.form_submissions force row level security;
revoke all on table public.form_submissions from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.form_submissions from service_role;
grant select on public.form_submissions to authenticated;

create policy "Patients, guardians and staff in scope read submitted forms" on public.form_submissions
  for select to authenticated
  using (
    patient_id in (select private.my_patient_ids())
    or (kind <> 'feedback' and private.in_scope(patient_id))
    or (kind = 'feedback' and private.can_read_feedback(patient_id))
  );

-- One answer line, left out when there is no answer.
create function private.form_line(_question text, _answer text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when nullif(btrim(_answer), '') is null then null
    else jsonb_build_object('question', _question, 'answer', btrim(_answer)) end;
$$;

create function private.yes_no(_value boolean)
returns text
language sql
immutable
set search_path = ''
as $$ select case when _value then 'Yes' when not _value then 'No' end; $$;

-- The answers of a repeat prescription request, as the patient gave them.
create function private.repeat_request_answers(_request uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with r as (select * from public.repeat_requests where id = _request),
  medicines as (
    select string_agg(
      coalesce(i.other_name, case when m.dose is not null then m.name || ' (' || m.dose || ')' else m.name end, p.name)
        || ', ' || case i.supply_months when 1 then '1 month' else '2 months' end,
      E'\n' order by i.created_at, i.id
    ) as list
    from public.repeat_request_items i
    left join public.medications m on m.id = i.medication_id
    left join public.prescribable_medicines p on p.id = i.medicine_id
    where i.request_id = _request
  )
  select coalesce(jsonb_agg(line order by n) filter (where line is not null), '[]'::jsonb)
  from r, medicines, lateral (values
    (1, private.form_line('Medicines', medicines.list)),
    (2, private.form_line('Do you have a future appointment booked?', private.yes_no(r.has_future_appointment))),
    (3, private.form_line('Would you like to book one?', private.yes_no(r.wants_appointment))),
    (4, private.form_line('Are you still losing weight?', private.yes_no(r.still_losing_weight))),
    (5, private.form_line('How much weight have you lost in the last month?', r.weight_lost_last_month)),
    (6, private.form_line('Do you have any side effects?', private.yes_no(r.has_side_effects))),
    (7, private.form_line('Describe the side effects', r.side_effects)),
    (8, private.form_line('Anything else the clinic should know?', r.note))
  ) as lines (n, line);
$$;

create function private.question_answers(_question uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(line order by n) filter (where line is not null), '[]'::jsonb)
  from public.questions q, lateral (values
    (1, private.form_line('Subject', q.subject)),
    (2, private.form_line('How soon do you need a reply?', case q.urgency when 'important' then 'Important' else 'Routine' end)),
    (3, private.form_line('Your question', q.body))
  ) as lines (n, line)
  where q.id = _question;
$$;

-- A repeat request is copied once its medicines are in (they are written after the request).
create function private.record_repeat_request_form()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.form_submissions (patient_id, kind, title, answers, source_id, submitted_by, submitted_at)
  select r.patient_id, 'repeat_request', 'Repeat prescription request', private.repeat_request_answers(r.id), r.id, r.requested_by, r.requested_at
  from public.repeat_requests r
  where r.id in (select distinct n.request_id from new_items n)
  on conflict (kind, source_id) do nothing;
  return null;
end;
$$;
create trigger repeat_request_items_record_form after insert on public.repeat_request_items
  referencing new table as new_items
  for each statement execute function private.record_repeat_request_form();

create function private.record_question_form()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.form_submissions (patient_id, kind, title, answers, source_id, submitted_by, submitted_at)
  values (new.patient_id, 'question', 'Question to the clinic', private.question_answers(new.id), new.id, new.asked_by, new.created_at)
  on conflict (kind, source_id) do nothing;
  return null;
end;
$$;
create trigger questions_record_form after insert on public.questions
  for each row execute function private.record_question_form();

-- 2. Feedback --------------------------------------------------------------------------------------

create table public.patient_feedback (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  appointment_id uuid unique references public.appointments (id) on delete restrict,
  sent_at timestamptz not null default now(),
  reminded_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  answered_at timestamptz,
  answered_by uuid references public.profiles (id) on delete restrict,
  score smallint check (score between 0 and 10),
  went_well text check (char_length(went_well) <= 2000),
  could_improve text check (char_length(could_improve) <= 2000),
  wants_contact boolean,
  may_quote boolean,
  rating text generated always as (
    case
      when answered_at is null then null
      when wants_contact or score <= 6 then 'red'
      when score <= 8 then 'amber'
      else 'green'
    end
  ) stored,
  follow_up_due date,
  created_at timestamptz not null default now(),
  constraint patient_feedback_id_patient_unique unique (id, patient_id),
  constraint patient_feedback_answered_whole check (
    (answered_at is null) = (answered_by is null)
    and (answered_at is null) = (score is null)
    and (answered_at is null) = (wants_contact is null)
    and (answered_at is null) = (may_quote is null)
  )
);
comment on table public.patient_feedback is 'A feedback survey sent after an appointment, and the answer. Rated green (9-10), amber (7-8) or red (0-6, or asked to be contacted). Read by admins, PAs and the patient''s doctors.';
comment on column public.patient_feedback.may_quote is 'The patient agreed their comments may be used without their name as evidence of feedback (CQC).';
comment on column public.patient_feedback.follow_up_due is 'Amber: two working days after the answer. Red: the same working day. Empty for green.';
create index patient_feedback_patient_idx on public.patient_feedback (patient_id, sent_at desc);
create index patient_feedback_answered_idx on public.patient_feedback (answered_at desc) where answered_at is not null;
create index patient_feedback_answered_by_idx on public.patient_feedback (answered_by);

create trigger patient_feedback_write_audit_log after insert or update or delete on public.patient_feedback
  for each row execute function private.write_audit_log();

alter table public.patient_feedback enable row level security;
alter table public.patient_feedback force row level security;
revoke all on table public.patient_feedback from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.patient_feedback from service_role;
grant select on public.patient_feedback to authenticated;

create policy "Patients, guardians, and admins, PAs and doctors in scope read feedback" on public.patient_feedback
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.can_read_feedback(patient_id));

create table public.feedback_follow_ups (
  feedback_id uuid primary key,
  -- The same value as feedback_id, so the audit log (which records a row's id) names the feedback.
  id uuid not null unique check (id = feedback_id),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  followed_up_by uuid not null references public.staff_profiles (id) on delete restrict,
  followed_up_at timestamptz not null default now(),
  constraint feedback_follow_ups_feedback_fkey foreign key (feedback_id, patient_id)
    references public.patient_feedback (id, patient_id) on delete restrict
);
comment on table public.feedback_follow_ups is 'How the clinic followed up amber or red feedback: who, when and the outcome. For the team only; never changed.';
create index feedback_follow_ups_feedback_patient_idx on public.feedback_follow_ups (feedback_id, patient_id);
create index feedback_follow_ups_patient_idx on public.feedback_follow_ups (patient_id);
create index feedback_follow_ups_by_idx on public.feedback_follow_ups (followed_up_by);

create trigger feedback_follow_ups_write_audit_log after insert or update or delete on public.feedback_follow_ups
  for each row execute function private.write_audit_log();
create trigger feedback_follow_ups_permanent before update or delete on public.feedback_follow_ups
  for each row execute function private.reject_permanent_change();
create trigger feedback_follow_ups_no_truncate before truncate on public.feedback_follow_ups
  for each statement execute function private.reject_permanent_change();

alter table public.feedback_follow_ups enable row level security;
alter table public.feedback_follow_ups force row level security;
revoke all on table public.feedback_follow_ups from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.feedback_follow_ups from service_role;
grant select on public.feedback_follow_ups to authenticated;

create policy "Admins, PAs and doctors in scope read feedback follow-ups" on public.feedback_follow_ups
  for select to authenticated
  using (private.can_read_feedback(patient_id));

-- The daily job: one survey per appointment completed in the last three days, for a patient who
-- can sign in (or has a guardian who can act), is still with the clinic, and has not been asked in
-- the last 90 days. Returns the new surveys so the job can send them. Server only.
create function private.queue_feedback()
returns table (feedback_id uuid, patient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := private.london_today();
  appt record;
  made uuid;
begin
  perform set_config('app.system_actor', 'feedback', true);
  for appt in
    select distinct on (a.patient_id) a.id, a.patient_id
    from public.appointments a
    join public.patient_profiles p on p.id = a.patient_id
    -- Completed, or still booked or confirmed once it has ended: nothing yet marks a visit completed
    -- (the GoHighLevel and Semble sync is planned), and cancelled visits and no-shows are left out.
    where (
        a.status = 'completed'
        or (a.status in ('booked', 'confirmed') and a.starts_at + make_interval(mins => a.duration_min) < now())
      )
      and (a.starts_at at time zone 'Europe/London')::date between today - 3 and today - 1
      and p.archived_at is null
      and (
        exists (select 1 from public.profiles u where u.id = p.user_id and u.status <> 'suspended')
        or exists (
          select 1 from public.patient_guardians g join public.profiles u on u.id = g.guardian_user_id
          where g.patient_id = p.id and g.can_act and g.verified_by is not null and u.status <> 'suspended'
        )
      )
      and not exists (select 1 from public.patient_feedback f where f.appointment_id = a.id)
      and not exists (
        select 1 from public.patient_feedback f
        where f.patient_id = a.patient_id and f.sent_at > now() - interval '90 days'
      )
    order by a.patient_id, a.starts_at desc
  loop
    insert into public.patient_feedback (patient_id, appointment_id) values (appt.patient_id, appt.id)
    returning id into made;
    feedback_id := made;
    patient_id := appt.patient_id;
    return next;
  end loop;
  perform set_config('app.system_actor', '', true);
end;
$$;

-- The daily job: unanswered surveys sent three or more days ago and not yet reminded about. Marks
-- them reminded and returns them. Server only.
create function private.due_feedback_reminders()
returns table (feedback_id uuid, patient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'feedback', true);
  return query
    update public.patient_feedback f
    set reminded_at = now()
    from public.patient_profiles p
    where p.id = f.patient_id and p.archived_at is null
      and f.answered_at is null and f.reminded_at is null
      and f.sent_at <= now() - interval '3 days' and f.expires_at > now()
    returning f.id, f.patient_id;
  perform set_config('app.system_actor', '', true);
end;
$$;

-- A patient, or a guardian who can act, answers. Returns the rating. Amber and red alert the team.
create function private.submit_feedback(
  _feedback uuid,
  _score integer,
  _went_well text,
  _could_improve text,
  _wants_contact boolean,
  _may_quote boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  f public.patient_feedback;
  result text;
  due date;
  today date := private.london_today();
begin
  select * into f from public.patient_feedback x where x.id = _feedback for update;
  if not found or actor is null or not private.can_act_for(f.patient_id) then
    raise exception 'You cannot answer this survey.' using errcode = '42501';
  end if;
  if f.answered_at is not null then
    raise exception 'This survey has already been answered.' using errcode = '23505';
  end if;
  if f.expires_at <= now() then
    raise exception 'This survey has closed.' using errcode = '22023';
  end if;
  if _score is null or _score not between 0 and 10 then
    raise exception 'Choose a score from 0 to 10.' using errcode = '22023';
  end if;
  if _wants_contact is null or _may_quote is null then
    raise exception 'Answer every question.' using errcode = '22023';
  end if;
  if char_length(_went_well) > 2000 or char_length(_could_improve) > 2000 then
    raise exception 'Use 2,000 characters or fewer for each answer.' using errcode = '22023';
  end if;

  result := case when _wants_contact or _score <= 6 then 'red' when _score <= 8 then 'amber' else 'green' end;
  due := case result
    when 'red' then private.working_day_from(today)
    when 'amber' then private.working_day_from(private.working_day_from(private.working_day_from(today) + 1) + 1)
  end;

  update public.patient_feedback
  set answered_at = now(), answered_by = actor, score = _score,
      went_well = nullif(btrim(_went_well), ''), could_improve = nullif(btrim(_could_improve), ''),
      wants_contact = _wants_contact, may_quote = _may_quote, follow_up_due = due
  where id = _feedback;

  insert into public.form_submissions (patient_id, kind, title, answers, source_id, submitted_by)
  values (
    f.patient_id, 'feedback', 'Feedback after your appointment',
    coalesce((
      select jsonb_agg(line order by n) filter (where line is not null)
      from (values
        (1, private.form_line('How likely are you to recommend The Schoeman Clinic to a friend or family member? (0 to 10)', _score::text)),
        (2, private.form_line('What went well?', _went_well)),
        (3, private.form_line('What could we do better?', _could_improve)),
        (4, private.form_line('Would you like someone from the clinic to contact you?', private.yes_no(_wants_contact))),
        (5, private.form_line('May we use your comments, without your name, as evidence of patient feedback?', private.yes_no(_may_quote)))
      ) as lines (n, line)
    ), '[]'::jsonb),
    _feedback, actor
  );

  if result in ('amber', 'red') then
    insert into public.notifications (user_id, topic, title, body, link)
    select distinct recipient, 'messages'::public.notification_topic,
      case result when 'red' then 'Feedback to follow up today' else 'Feedback to follow up' end,
      case result when 'red' then 'A patient''s feedback needs a follow-up today.' else 'A patient''s feedback needs a follow-up within two working days.' end,
      '/clinic/feedback/' || _feedback::text
    from (
      select r.user_id as recipient
      from public.user_roles r join public.profiles u on u.id = r.user_id
      where r.role in ('admin', 'pa') and u.status <> 'suspended'
      union
      select s.user_id
      from public.care_team ct join public.staff_profiles s on s.id = ct.staff_id
      join public.profiles u on u.id = s.user_id
      where result = 'red' and ct.patient_id = f.patient_id and s.clinical_role = 'doctor'
        and s.active and s.archived_at is null and u.status <> 'suspended'
        and ct.since <= today and (ct.until is null or ct.until > today)
    ) recipients
    -- Nobody is alerted about feedback on their own record or that of someone they look after.
    where recipient <> actor
      and not exists (select 1 from public.patient_profiles p where p.id = f.patient_id and p.user_id = recipient)
      and not exists (select 1 from public.patient_guardians g where g.patient_id = f.patient_id and g.guardian_user_id = recipient);
  end if;

  return result;
end;
$$;

-- An admin, PA or doctor who can read the feedback records the follow-up of an answered survey.
create function private.record_feedback_follow_up(_feedback uuid, _note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff uuid := private.my_staff_id();
  f public.patient_feedback;
begin
  select * into f from public.patient_feedback x where x.id = _feedback;
  if not found or staff is null or not private.can_read_feedback(f.patient_id) then
    raise exception 'You cannot follow up this feedback.' using errcode = '42501';
  end if;
  if f.answered_at is null then
    raise exception 'This survey has not been answered.' using errcode = '22023';
  end if;
  if nullif(btrim(_note), '') is null or char_length(btrim(_note)) > 2000 then
    raise exception 'Describe the follow-up, in up to 2,000 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.feedback_follow_ups x where x.feedback_id = _feedback) then
    raise exception 'The follow-up has already been recorded.' using errcode = '23505';
  end if;
  insert into public.feedback_follow_ups (feedback_id, id, patient_id, note, followed_up_by)
  values (_feedback, _feedback, f.patient_id, btrim(_note), staff);
end;
$$;

-- Wrappers in the exposed schema, and who may call what.
create function public.queue_feedback()
returns table (feedback_id uuid, patient_id uuid) language sql security invoker set search_path = ''
as $$ select * from private.queue_feedback(); $$;
create function public.due_feedback_reminders()
returns table (feedback_id uuid, patient_id uuid) language sql security invoker set search_path = ''
as $$ select * from private.due_feedback_reminders(); $$;
create function public.submit_feedback(_feedback uuid, _score integer, _went_well text, _could_improve text, _wants_contact boolean, _may_quote boolean)
returns text language sql security invoker set search_path = ''
as $$ select private.submit_feedback(_feedback, _score, _went_well, _could_improve, _wants_contact, _may_quote); $$;
create function public.record_feedback_follow_up(_feedback uuid, _note text)
returns void language sql security invoker set search_path = ''
as $$ select private.record_feedback_follow_up(_feedback, _note); $$;

revoke all on function
  private.reject_permanent_change(),
  private.working_day_from(date),
  private.can_read_feedback(uuid),
  private.form_line(text, text),
  private.yes_no(boolean),
  private.repeat_request_answers(uuid),
  private.question_answers(uuid),
  private.record_repeat_request_form(),
  private.record_question_form(),
  private.queue_feedback(),
  private.due_feedback_reminders(),
  private.submit_feedback(uuid, integer, text, text, boolean, boolean),
  private.record_feedback_follow_up(uuid, text),
  public.queue_feedback(),
  public.due_feedback_reminders(),
  public.submit_feedback(uuid, integer, text, text, boolean, boolean),
  public.record_feedback_follow_up(uuid, text)
from public, anon, authenticated;
-- Row-level security calls this for signed-in people.
grant execute on function private.can_read_feedback(uuid) to authenticated;
grant execute on function
  private.submit_feedback(uuid, integer, text, text, boolean, boolean),
  private.record_feedback_follow_up(uuid, text),
  public.submit_feedback(uuid, integer, text, text, boolean, boolean),
  public.record_feedback_follow_up(uuid, text)
to authenticated;
grant execute on function
  private.queue_feedback(),
  private.due_feedback_reminders(),
  public.queue_feedback(),
  public.due_feedback_reminders()
to service_role;

-- Copy the forms made before today, once.
select set_config('app.system_actor', 'forms-backfill', true);
insert into public.form_submissions (patient_id, kind, title, answers, source_id, submitted_by, submitted_at)
select r.patient_id, 'repeat_request', 'Repeat prescription request', private.repeat_request_answers(r.id), r.id, r.requested_by, r.requested_at
from public.repeat_requests r
where jsonb_array_length(private.repeat_request_answers(r.id)) > 0
on conflict (kind, source_id) do nothing;
insert into public.form_submissions (patient_id, kind, title, answers, source_id, submitted_by, submitted_at)
select q.patient_id, 'question', 'Question to the clinic', private.question_answers(q.id), q.id, q.asked_by, q.created_at
from public.questions q
on conflict (kind, source_id) do nothing;
select set_config('app.system_actor', '', true);
