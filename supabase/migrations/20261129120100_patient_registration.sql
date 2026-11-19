-- The clinic's registration form (the one Semble sends every new patient), recreated in Clinic Hub. A new patient
-- completes it once, after accepting the invitation, and cannot use the portal until it is done. What they
-- answer is kept three ways: the structured details a team member needs (address, next of kin, GP, occupation,
-- why they came), a permanent copy of the form as asked and answered (Submitted forms), and the photo ID in a
-- private bucket that only PAs and admins can open. Existing patients, and patients added by an import, do not
-- complete it (decided 19 November 2026); children and guardians are not decided yet.

-- 1. Who must complete it ---------------------------------------------------------------------------

alter table public.patient_profiles add column registration_required boolean not null default false;
alter table public.patient_profiles alter column registration_required set default true;
comment on column public.patient_profiles.registration_required is 'True for a patient added after 19 November 2026: they complete the registration form before using the portal. False for every patient who existed before, and for patients imported from Semble.';
drop trigger patient_profiles_reject_client_changes on public.patient_profiles;
create trigger patient_profiles_reject_client_changes before update on public.patient_profiles
  for each row execute function private.reject_client_changes('id', 'user_id', 'clinic_ref', 'ghl_contact_id', 'semble_patient_id', 'stripe_customer_id', 'online_check_reminded_at', 'registration_required');

-- 2. The registration -------------------------------------------------------------------------------

create table public.patient_registrations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patient_profiles (id) on delete restrict,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  submitted_at timestamptz not null default now(),
  version text not null check (char_length(version) between 1 and 40),
  title text check (char_length(title) <= 40),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  town text check (char_length(town) <= 120),
  postcode text check (char_length(postcode) <= 20),
  country text check (char_length(country) <= 80),
  next_of_kin_name text not null check (char_length(btrim(next_of_kin_name)) between 1 and 120),
  next_of_kin_relationship text not null check (char_length(btrim(next_of_kin_relationship)) between 1 and 80),
  next_of_kin_phone text not null check (char_length(btrim(next_of_kin_phone)) between 5 and 30),
  gp_name text not null check (char_length(btrim(gp_name)) between 1 and 120),
  gp_practice text not null check (char_length(btrim(gp_practice)) between 1 and 400),
  occupation text not null check (char_length(btrim(occupation)) between 1 and 120),
  main_reason text not null check (char_length(btrim(main_reason)) between 1 and 2000),
  concern_duration text not null check (char_length(btrim(concern_duration)) between 1 and 500),
  already_tried text not null check (char_length(btrim(already_tried)) between 1 and 2000),
  health_goals text not null check (char_length(btrim(health_goals)) between 1 and 2000),
  identity_path text not null,
  identity_checked_by uuid references public.profiles (id) on delete restrict,
  identity_checked_at timestamptz,
  news_opt_out boolean not null default false,
  whatsapp_consent boolean not null default false,
  agreed_at timestamptz not null default now(),
  constraint patient_registrations_identity_checked check ((identity_checked_by is null) = (identity_checked_at is null))
);
comment on table public.patient_registrations is 'The answers a new patient gave on the registration form, made once by submit_registration. Permanent: only the identity check is ever added later.';
comment on column public.patient_registrations.identity_path is 'The photo ID in the private identity bucket. Only PAs and admins can open it.';
comment on column public.patient_registrations.version is 'The wording of the form and of the consent that was agreed.';
comment on column public.patient_registrations.news_opt_out is 'True when the patient asked not to receive news and insights from the doctors. Kept in Clinic Hub only for now: GoHighLevel is not told.';
create index patient_registrations_submitted_by_idx on public.patient_registrations (submitted_by);
create index patient_registrations_identity_checked_by_idx on public.patient_registrations (identity_checked_by);

create trigger patient_registrations_write_audit_log after insert or update or delete on public.patient_registrations
  for each row execute function private.write_audit_log();

-- Never changed: the one column pair that may be written later is the identity check, by check_identity.
create function private.reject_registration_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'A registration is permanent and cannot be removed.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'identity_checked_by' - 'identity_checked_at') is distinct from (to_jsonb(old) - 'identity_checked_by' - 'identity_checked_at') then
    raise exception 'A registration is permanent and cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger patient_registrations_permanent before update or delete on public.patient_registrations
  for each row execute function private.reject_registration_change();
create trigger patient_registrations_no_truncate before truncate on public.patient_registrations
  for each statement execute function private.reject_registration_change();

alter table public.patient_registrations enable row level security;
alter table public.patient_registrations force row level security;
revoke all on table public.patient_registrations from public, anon, authenticated, service_role;
grant select on public.patient_registrations to authenticated;
create policy "Patients and staff in scope read registrations" on public.patient_registrations
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));
-- No write policy: submit_registration and check_identity (as the table owner) are the only writers.

-- 3. Who is asked, and the private bucket for the ID ----------------------------------------------------

create function private.my_own_patient_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.patient_profiles p where p.user_id = (select auth.uid()) and p.archived_at is null;
$$;

-- True when the signed-in patient has to complete the form and has not yet.
create function private.registration_needed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.registration_required and not exists (select 1 from public.patient_registrations r where r.patient_id = p.id)
    from public.patient_profiles p
    where p.user_id = (select auth.uid()) and p.archived_at is null
  ), false);
$$;

-- What the form needs to know about the signed-in patient: who they are (shown, not typed again), what the record
-- already holds, and whether the form is still to do. A patient cannot read their own patient row directly.
create function private.my_registration()
returns table (patient_id uuid, needed boolean, first_name text, last_name text, date_of_birth date, email text, phone text, sex text, gender text, country text, address_line1 text, address_line2 text, city text, postcode text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
    p.registration_required and not exists (select 1 from public.patient_registrations r where r.patient_id = p.id),
    p.first_name, p.last_name, p.date_of_birth, (select u.email from public.profiles u where u.id = p.user_id),
    p.contact_phone, p.sex, p.gender_identity, p.country, p.address_line1, p.address_line2, p.city, p.postcode
  from public.patient_profiles p
  where p.user_id = (select auth.uid()) and p.archived_at is null;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity', 'identity', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']);

-- A patient adds one file for themselves while the form is still to be done, at <patient id>/<uuid>.<pdf|jpg|png>.
create policy "Patients upload their own identity document" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'identity'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$'
    and (storage.foldername(name))[1] = (select private.my_own_patient_id())::text
    and (select private.registration_needed())
  );
-- No policy reads the file for anyone signed in. A PA or admin opens it only through the route that logs the view
-- first and then signs a short link with server code, so no opening can skip the activity log.
-- No update or delete policy: the file is kept for good.

-- 4. Submitting ------------------------------------------------------------------------------------------

create function private.submit_registration(_d jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.patient_profiles;
  reg uuid;
  who uuid := (select auth.uid());
  path text := btrim(coalesce(_d ->> 'identity_path', ''));
  sex_given text := nullif(btrim(coalesce(_d ->> 'sex', '')), '');
  email_line text;
  answers jsonb;
  address_text text;
begin
  select * into p from public.patient_profiles where user_id = who and archived_at is null for update;
  if not found then
    raise exception 'Only a patient can complete this form for themselves.' using errcode = '42501';
  end if;
  if not p.registration_required then
    raise exception 'You do not need to complete this form.' using errcode = '22023';
  end if;
  if exists (select 1 from public.patient_registrations r where r.patient_id = p.id) then
    raise exception 'This form is already complete.' using errcode = '22023';
  end if;
  if coalesce((_d ->> 'agreed')::boolean, false) is not true then
    raise exception 'Confirm your details and agree to continue.' using errcode = '22023';
  end if;
  if sex_given is null or sex_given not in ('F', 'M') then
    raise exception 'Choose your sex at birth.' using errcode = '22023';
  end if;
  if path !~ ('^' || p.id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$')
    or not exists (select 1 from storage.objects o where o.bucket_id = 'identity' and o.name = path) then
    raise exception 'Upload a copy of your photo ID.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(array['next_of_kin_name', 'next_of_kin_relationship', 'next_of_kin_phone', 'gp_name', 'gp_practice', 'occupation', 'main_reason', 'concern_duration', 'already_tried', 'health_goals']) k
    where nullif(btrim(coalesce(_d ->> k, '')), '') is null
  ) then
    raise exception 'Answer every question marked as needed.' using errcode = '22023';
  end if;

  insert into public.patient_registrations (
    patient_id, submitted_by, version, title, address_line1, address_line2, town, postcode, country,
    next_of_kin_name, next_of_kin_relationship, next_of_kin_phone, gp_name, gp_practice, occupation,
    main_reason, concern_duration, already_tried, health_goals, identity_path, news_opt_out, whatsapp_consent
  ) values (
    p.id, who, coalesce(nullif(btrim(_d ->> 'version'), ''), 'unversioned'),
    nullif(btrim(coalesce(_d ->> 'title', '')), ''), nullif(btrim(coalesce(_d ->> 'address_line1', '')), ''),
    nullif(btrim(coalesce(_d ->> 'address_line2', '')), ''), nullif(btrim(coalesce(_d ->> 'town', '')), ''),
    nullif(btrim(coalesce(_d ->> 'postcode', '')), ''), nullif(btrim(coalesce(_d ->> 'country', '')), ''),
    btrim(_d ->> 'next_of_kin_name'), btrim(_d ->> 'next_of_kin_relationship'), btrim(_d ->> 'next_of_kin_phone'),
    btrim(_d ->> 'gp_name'), btrim(_d ->> 'gp_practice'), btrim(_d ->> 'occupation'),
    btrim(_d ->> 'main_reason'), btrim(_d ->> 'concern_duration'), btrim(_d ->> 'already_tried'), btrim(_d ->> 'health_goals'),
    path, coalesce((_d ->> 'news_opt_out')::boolean, false), coalesce((_d ->> 'whatsapp_consent')::boolean, false)
  ) returning id into reg;

  -- What the record still lacks is filled in from the form; what is already there is never overwritten.
  update public.patient_profiles
  set sex = coalesce(sex, sex_given),
      gender_identity = coalesce(gender_identity, nullif(btrim(coalesce(_d ->> 'gender', '')), '')),
      contact_phone = coalesce(contact_phone, nullif(btrim(coalesce(_d ->> 'phone', '')), '')),
      country = coalesce(country, nullif(btrim(coalesce(_d ->> 'country', '')), '')),
      address_line1 = coalesce(address_line1, nullif(btrim(coalesce(_d ->> 'address_line1', '')), '')),
      address_line2 = coalesce(address_line2, nullif(btrim(coalesce(_d ->> 'address_line2', '')), '')),
      city = coalesce(city, nullif(btrim(coalesce(_d ->> 'town', '')), '')),
      postcode = coalesce(postcode, nullif(btrim(coalesce(_d ->> 'postcode', '')), ''))
  where id = p.id;

  -- WhatsApp: consent turns on WhatsApp for the four kinds of message; no consent leaves it as it was.
  if coalesce((_d ->> 'whatsapp_consent')::boolean, false) then
    insert into public.notification_preferences (user_id, topic, channel, enabled)
    select who, t.topic, 'whatsapp', true from unnest(enum_range(null::public.notification_topic)) as t(topic)
    on conflict (user_id, topic, channel) do update set enabled = true;
  end if;

  select u.email into email_line from public.profiles u where u.id = who;
  address_text := nullif(btrim(concat_ws(', ', nullif(btrim(coalesce(_d ->> 'address_line1', '')), ''), nullif(btrim(coalesce(_d ->> 'address_line2', '')), ''),
    nullif(btrim(coalesce(_d ->> 'town', '')), ''), nullif(btrim(coalesce(_d ->> 'postcode', '')), ''), nullif(btrim(coalesce(_d ->> 'country', '')), ''))), '');
  -- A permanent copy of the form as asked and answered; a question with no answer is left out.
  select coalesce(jsonb_agg(jsonb_build_object('question', q.question, 'answer', q.answer) order by q.ord), '[]'::jsonb) into answers
  from (values
    (1, 'Title', nullif(btrim(coalesce(_d ->> 'title', '')), '')),
    (2, 'First name', p.first_name),
    (3, 'Last name', p.last_name),
    (4, 'Date of birth', to_char(p.date_of_birth, 'DD Mon YYYY')),
    (5, 'Email', email_line),
    (6, 'Address', address_text),
    (7, 'Gender', nullif(btrim(coalesce(_d ->> 'gender', '')), '')),
    (8, 'Phone number', nullif(btrim(coalesce(_d ->> 'phone', '')), '')),
    (9, 'Next of kin, name', btrim(_d ->> 'next_of_kin_name')),
    (10, 'Next of kin, relationship to you', btrim(_d ->> 'next_of_kin_relationship')),
    (11, 'Next of kin, telephone', btrim(_d ->> 'next_of_kin_phone')),
    (12, 'GP name', btrim(_d ->> 'gp_name')),
    (13, 'GP practice name and address', btrim(_d ->> 'gp_practice')),
    (14, 'Sex at birth', case sex_given when 'F' then 'Female' else 'Male' end),
    (15, 'Occupation', btrim(_d ->> 'occupation')),
    (16, 'What is the main reason for your visit today?', btrim(_d ->> 'main_reason')),
    (17, 'How long have you had this concern?', btrim(_d ->> 'concern_duration')),
    (18, 'What have you already tried (treatments, diets, supplements, practitioners)?', btrim(_d ->> 'already_tried')),
    (19, 'What are your top three health goals for the next 12 months?', btrim(_d ->> 'health_goals')),
    (20, 'Photo ID (passport or driving licence)', 'Uploaded'),
    (21, 'I confirm my details are accurate and I agree to the Privacy Notice and the Terms of Treatment and Fees', 'Agreed'),
    (22, 'I would prefer not to receive news and insights from the doctors', case when coalesce((_d ->> 'news_opt_out')::boolean, false) then 'Yes' else 'No' end),
    (23, 'I consent to receiving WhatsApp messages about my care', case when coalesce((_d ->> 'whatsapp_consent')::boolean, false) then 'Yes' else 'No' end)
  ) as q(ord, question, answer)
  where q.answer is not null;
  insert into public.form_submissions (patient_id, kind, title, answers, source_id, submitted_by)
  values (p.id, 'registration', 'Registration form', answers, reg, who);
  return reg;
end;
$$;
comment on function private.submit_registration(jsonb) is 'A new patient submits the registration form for themselves, once. Writes the registration, fills gaps on their record, may turn on WhatsApp, and keeps a permanent copy of the form.';

-- A PA or admin marks the photo ID as checked.
create function private.check_identity(_patient uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.patient_registrations;
begin
  if not ((select private.has_role('pa')) or (select private.has_role('admin'))) or not private.in_scope(_patient) then
    raise exception 'You cannot check this identity.' using errcode = '42501';
  end if;
  select * into r from public.patient_registrations where patient_id = _patient for update;
  if not found then
    raise exception 'This patient has no registration.' using errcode = '22023';
  end if;
  if r.identity_checked_at is not null then
    raise exception 'This identity is already checked.' using errcode = '22023';
  end if;
  update public.patient_registrations set identity_checked_by = (select auth.uid()), identity_checked_at = now() where id = r.id;
end;
$$;

-- Opening the ID is written to the activity log, once every ten minutes at most.
create function private.log_identity_view(_patient uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  reg uuid;
  role_held public.app_role;
begin
  if actor is null or not ((select private.has_role('pa')) or (select private.has_role('admin'))) or not private.in_scope(_patient) then
    raise exception 'You cannot open this identity document.' using errcode = '42501';
  end if;
  select r.id into reg from public.patient_registrations r where r.patient_id = _patient;
  if reg is null then
    raise exception 'This patient has no registration.' using errcode = '22023';
  end if;
  select r.role into role_held from public.user_roles r where r.user_id = actor and r.role in ('pa', 'admin') order by (r.role = 'admin') limit 1;
  if exists (
    select 1 from public.audit_log a
    where a.actor_id = actor and a.action = 'viewed' and a.entity = 'patient_registrations' and a.entity_id = reg
      and a.created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, metadata)
  values (actor, role_held, 'viewed', 'patient_registrations', reg, jsonb_build_object('patient_id', _patient, 'file', 'identity'));
end;
$$;

create function public.registration_needed()
returns boolean language sql stable security invoker set search_path = '' as $$ select private.registration_needed(); $$;
create function public.my_registration()
returns table (patient_id uuid, needed boolean, first_name text, last_name text, date_of_birth date, email text, phone text, sex text, gender text, country text, address_line1 text, address_line2 text, city text, postcode text)
language sql stable security invoker set search_path = '' as $$ select * from private.my_registration(); $$;
create function public.submit_registration(_d jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select private.submit_registration(_d); $$;
create function public.check_identity(_patient uuid)
returns void language sql security invoker set search_path = '' as $$ select private.check_identity(_patient); $$;
create function public.log_identity_view(_patient uuid)
returns void language sql security invoker set search_path = '' as $$ select private.log_identity_view(_patient); $$;

revoke all on function
  private.my_own_patient_id(), private.registration_needed(), private.my_registration(), private.submit_registration(jsonb), private.check_identity(uuid), private.log_identity_view(uuid),
  private.reject_registration_change(),
  public.registration_needed(), public.my_registration(), public.submit_registration(jsonb), public.check_identity(uuid), public.log_identity_view(uuid)
from public, anon, authenticated;
grant execute on function
  private.my_own_patient_id(), private.registration_needed(), private.my_registration(), private.submit_registration(jsonb), private.check_identity(uuid), private.log_identity_view(uuid),
  public.registration_needed(), public.my_registration(), public.submit_registration(jsonb), public.check_identity(uuid), public.log_identity_view(uuid)
to authenticated;

-- The Activity screen lists registrations and every opening of a photo ID, with the patient each is about.
create or replace function private.activity_log(_limit integer default 50, _before bigint default null)
returns table (
  id bigint,
  created_at timestamptz,
  actor_name text,
  actor_role public.app_role,
  action text,
  entity text,
  patient_name text,
  patient_ref text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_role('admin')) then
    raise exception 'Only an admin can read the activity log.' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.created_at,
    p.full_name,
    a.actor_role,
    a.action,
    a.entity,
    pp.first_name || ' ' || pp.last_name,
    pp.clinic_ref
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  left join public.patient_profiles pp on pp.id = coalesce(
    private.try_uuid(a.metadata ->> 'patient_id'),
    case a.entity
      when 'patient_profiles' then a.entity_id
      when 'lab_reports' then (select l.patient_id from public.lab_reports l where l.id = a.entity_id)
      when 'results' then (select r.patient_id from public.results r where r.id = a.entity_id)
      when 'lab_report_signoffs' then (select s.patient_id from public.lab_report_signoffs s where s.report_id = a.entity_id)
      when 'patient_feedback' then (select f.patient_id from public.patient_feedback f where f.id = a.entity_id)
      when 'feedback_follow_ups' then (select f.patient_id from public.feedback_follow_ups f where f.feedback_id = a.entity_id)
      when 'form_submissions' then (select f.patient_id from public.form_submissions f where f.id = a.entity_id)
      when 'patient_registrations' then (select r.patient_id from public.patient_registrations r where r.id = a.entity_id)
    end
  )
  where (_before is null or a.id < _before)
    -- A fixed list: an admin must not learn that a safeguarding alert, a diagnosis or a medicine exists.
    and a.entity in (
      'patient_profiles', 'lab_reports', 'results', 'lab_orders', 'documents',
      'result_imports', 'invitations', 'staff_profiles', 'user_roles', 'profiles',
      'lab_report_signoffs', 'patient_feedback', 'feedback_follow_ups', 'form_submissions', 'patient_registrations'
    )
  order by a.id desc
  limit least(greatest(coalesce(_limit, 50), 1), 100);
end;
$$;
