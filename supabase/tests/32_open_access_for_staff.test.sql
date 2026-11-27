-- Open access for the team, decided by Dr Schoeman on 27 November 2026: every doctor, nurse, health
-- coach, PA and admin opens and writes in every patient's record and sees every clinician's diary;
-- safeguarding alerts are read by all five and added or changed only by doctors. What each role may do
-- stays as it was. Fixed ids come from supabase/seed.sql. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema t;

create function t.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function t.n(_user uuid, _sql text) returns int language plpgsql as $$
declare result int;
begin
  perform t.become(_user);
  execute format('select count(*) from (%s) q', _sql) into result;
  reset role;
  return result;
end;
$$;

create function t.run(_user uuid, _sql text) returns int language plpgsql as $$
declare affected int;
begin
  perform t.become(_user);
  execute _sql;
  get diagnostics affected = row_count;
  reset role;
  return affected;
end;
$$;

grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

create function t.gina() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.laura() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000002'::uuid $$;
create function t.priya() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000003'::uuid $$;
create function t.coach() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000005'::uuid $$;
create function t.admin() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000006'::uuid $$;
create function t.nora() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000007'::uuid $$;
create function t.eleanor() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000011'::uuid $$;
create function t.ruth() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000022'::uuid $$;
create function t.s_gina() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.s_laura() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000002'::uuid $$;
create function t.s_coach() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000005'::uuid $$;
create function t.s_nora() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000007'::uuid $$;
-- Eleanor is Gina's patient. Nobody below is on her care team except Gina.
create function t.p_eleanor() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-000000000001'::uuid $$;
-- Dr Laura Bennett is also a patient (record d..0b).
create function t.p_laura() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-00000000000b'::uuid $$;

-- Every role opens every patient ------------------------------------------------------------------

select is(t.n(t.laura(), 'select * from public.patient_profiles'), (select count(*)::int from public.patient_profiles) - 1, 'a doctor opens every patient but herself');
select is(t.n(t.nora(), 'select * from public.patient_profiles'), (select count(*)::int from public.patient_profiles), 'a nurse opens every patient');
select is(t.n(t.coach(), 'select * from public.patient_profiles'), (select count(*)::int from public.patient_profiles), 'a health coach opens every patient');
select is(t.n(t.priya(), 'select * from public.patient_profiles'), (select count(*)::int from public.patient_profiles), 'a PA opens every patient');
select is(t.n(t.admin(), 'select * from public.patient_profiles'), (select count(*)::int from public.patient_profiles), 'an admin opens every patient');
select is(t.n(t.nora(), format('select * from public.care_team where staff_id = %L', t.s_nora())), 0, 'and the nurse is on no care team');

-- Any doctor, nurse or health coach writes in any patient's record ------------------------------------

select is(
  t.run(t.laura(), format($q$insert into public.clinical_notes (patient_id, author_id, title, body) values (%L, %L, 'Cover', 'Seen.')$q$, t.p_eleanor(), t.s_laura())),
  1, 'a doctor adds a note to a patient on another care team');
select is(
  t.run(t.nora(), format($q$insert into public.clinical_notes (patient_id, author_id, title, body) values (%L, %L, 'Nursing', 'Seen.')$q$, t.p_eleanor(), t.s_nora())),
  1, 'a nurse adds a note to a patient on another care team');
select is(
  t.run(t.coach(), format($q$insert into public.clinical_notes (patient_id, author_id, title, body) values (%L, %L, 'Coaching', 'Seen.')$q$, t.p_eleanor(), t.s_coach())),
  1, 'a health coach adds a note to a patient on another care team');
select is(
  t.run(t.nora(), format($q$insert into public.patient_allergies (patient_id, substance, recorded_by) values (%L, 'Latex', %L)$q$, t.p_eleanor(), t.s_nora())),
  1, 'a nurse records an allergy for any patient');

-- What each role may do has not changed --------------------------------------------------------------

select throws_ok(
  format($$ select t.run(t.coach(), $q$select public.release_report(%L)$q$) $$, (select id from public.lab_reports where patient_id = t.p_eleanor() and released_at is null limit 1)),
  '42501', null, 'a health coach cannot release results');
select throws_ok(
  format($$ select t.run(t.nora(), $q$select public.release_report(%L)$q$) $$, (select id from public.lab_reports where patient_id = t.p_eleanor() and released_at is null limit 1)),
  '42501', null, 'a nurse cannot release results');
select throws_ok(
  format($$ select t.run(t.coach(), $q$insert into public.diagnoses (patient_id, label, recorded_by) values (%L, 'Test', %L)$q$) $$, t.p_eleanor(), t.s_coach()),
  '42501', null, 'a health coach cannot record a diagnosis');
select throws_ok(
  format($$ select t.run(t.nora(), $q$insert into public.diagnoses (patient_id, label, recorded_by) values (%L, 'Test', %L)$q$) $$, t.p_eleanor(), t.s_nora()),
  '42501', null, 'a nurse cannot record a diagnosis');
select is(t.n(t.coach(), 'select * from public.result_imports'), 0, 'a health coach still cannot read the import queue');
select throws_ok($$ select t.n(t.coach(), 'select * from public.audit_log') $$, '42501', null, 'a health coach still cannot read the activity log');

-- Safeguarding alerts: read by all five roles, written by doctors ----------------------------------------

select is(t.n(t.gina(), 'select * from public.safeguarding_alerts'), (select count(*)::int from public.safeguarding_alerts), 'a doctor reads every safeguarding alert');
select is(t.n(t.nora(), 'select * from public.safeguarding_alerts'), (select count(*)::int from public.safeguarding_alerts), 'a nurse reads every safeguarding alert');
select is(t.n(t.coach(), 'select * from public.safeguarding_alerts'), (select count(*)::int from public.safeguarding_alerts), 'a health coach reads every safeguarding alert');
select is(t.n(t.priya(), 'select * from public.safeguarding_alerts'), (select count(*)::int from public.safeguarding_alerts), 'a PA reads every safeguarding alert');
select is(t.n(t.admin(), 'select * from public.safeguarding_alerts'), (select count(*)::int from public.safeguarding_alerts), 'an admin reads every safeguarding alert');

select is(
  t.run(t.laura(), format($q$insert into public.safeguarding_alerts (patient_id, alert_type, severity, note, added_by) values (%L, 'Communication', 'low', 'Prefers email.', %L)$q$, t.p_eleanor(), t.s_laura())),
  1, 'a doctor adds an alert to any patient');
select throws_ok(
  format($$ select t.run(t.nora(), $q$insert into public.safeguarding_alerts (patient_id, alert_type, severity, note, added_by) values (%L, 'Communication', 'low', 'x', %L)$q$) $$, t.p_eleanor(), t.s_nora()),
  '42501', null, 'a nurse cannot add one');
select throws_ok(
  format($$ select t.run(t.coach(), $q$insert into public.safeguarding_alerts (patient_id, alert_type, severity, note, added_by) values (%L, 'Communication', 'low', 'x', %L)$q$) $$, t.p_eleanor(), t.s_coach()),
  '42501', null, 'a health coach cannot add one');
select throws_ok(
  format($$ select t.run(t.priya(), $q$insert into public.safeguarding_alerts (patient_id, alert_type, severity, note, added_by) values (%L, 'Communication', 'low', 'x', 'b0000000-0000-4000-8000-000000000003')$q$) $$, t.p_eleanor()),
  '42501', null, 'a PA cannot add one');
select throws_ok(
  format($$ select t.run(t.admin(), $q$insert into public.safeguarding_alerts (patient_id, alert_type, severity, note, added_by) values (%L, 'Communication', 'low', 'x', 'b0000000-0000-4000-8000-000000000006')$q$) $$, t.p_eleanor()),
  '42501', null, 'an admin cannot add one');
select is(t.run(t.nora(), $q$update public.safeguarding_alerts set note = 'Changed'$q$), 0, 'a nurse cannot change one');
select is(t.run(t.coach(), $q$update public.safeguarding_alerts set note = 'Changed'$q$), 0, 'a health coach cannot change one');
select is(t.run(t.priya(), $q$update public.safeguarding_alerts set note = 'Changed'$q$), 0, 'a PA cannot change one');
select is(t.run(t.admin(), $q$update public.safeguarding_alerts set note = 'Changed'$q$), 0, 'an admin cannot change one');
select cmp_ok(t.run(t.gina(), $q$update public.safeguarding_alerts set note = note$q$), '>', 0, 'a doctor changes alerts');

-- Patients and guardians never read an alert ------------------------------------------------------------

select is(t.n(t.eleanor(), 'select * from public.safeguarding_alerts'), 0, 'a patient reads no safeguarding alert');
select is(t.n(t.ruth(), 'select * from public.safeguarding_alerts'), 0, 'a guardian reads no safeguarding alert');

-- The diary: every clinician's bookings, to every member of the team -------------------------------------

insert into public.appointments (patient_id, clinician_id, location_id, starts_at, duration_min, type, status, source)
  values ('d0000000-0000-4000-8000-000000000004', t.s_laura(), 'c0000000-0000-4000-8000-000000000001', now() + interval '2 days', 30, 'Follow-up', 'confirmed', 'clinic_hub');
select cmp_ok((select count(distinct clinician_id)::int from public.appointments where status <> 'cancelled' and starts_at between now() and now() + interval '7 days'), '>=', 2, 'two clinicians have bookings this week');

create function t.clinicians_seen(_user uuid) returns int language plpgsql as $$
declare result int;
begin
  perform t.become(_user);
  select count(distinct d.clinician_id)::int into result from public.clinic_diary(now(), now() + interval '7 days') d;
  reset role;
  return result;
end;
$$;
grant execute on function t.clinicians_seen(uuid) to authenticated;

select is(t.clinicians_seen(t.nora()), (select count(distinct clinician_id)::int from public.appointments where status <> 'cancelled' and starts_at < now() + interval '7 days' and starts_at + make_interval(mins => duration_min) > now()), 'a nurse sees every clinician''s bookings');
select is(t.clinicians_seen(t.coach()), (select count(distinct clinician_id)::int from public.appointments where status <> 'cancelled' and starts_at < now() + interval '7 days' and starts_at + make_interval(mins => duration_min) > now()), 'a health coach sees every clinician''s bookings');
select is(t.clinicians_seen(t.laura()), (select count(distinct clinician_id)::int from public.appointments where status <> 'cancelled' and starts_at < now() + interval '7 days' and starts_at + make_interval(mins => duration_min) > now()), 'a doctor sees every clinician''s bookings');
select cmp_ok(t.clinicians_seen(t.nora()), '>=', 2, 'and that is more than one clinician');

-- Nobody opens their own record as staff, whatever the role ---------------------------------------------------

select is(t.n(t.laura(), format('select * from public.patient_profiles where id = %L', t.p_laura())), 0, 'a doctor does not open her own record');
insert into public.safeguarding_alerts (patient_id, alert_type, severity, note, added_by) values (t.p_laura(), 'Communication', 'low', 'About a colleague.', t.s_gina());
select is(t.n(t.laura(), format('select * from public.safeguarding_alerts where patient_id = %L', t.p_laura())), 0, 'nor alerts about herself');
select is(t.n(t.gina(), format('select * from public.safeguarding_alerts where patient_id = %L', t.p_laura())), 1, 'while another doctor reads them');

-- A suspended account sees nothing -------------------------------------------------------------------------------

update public.profiles set status = 'suspended' where id = t.nora();
select is(t.n(t.nora(), 'select * from public.patient_profiles'), 0, 'a suspended nurse sees no patient');
select is(t.n(t.nora(), 'select * from public.safeguarding_alerts'), 0, 'and no safeguarding alert');
select throws_ok($$ select t.clinicians_seen(t.nora()) $$, '42501', null, 'and cannot read the diary');

select * from finish();
rollback;
