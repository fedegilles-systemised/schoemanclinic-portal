-- GoHighLevel contact link and patient booking (decided 11 to 12 November 2026).
-- Ids from supabase/seed.sql: Eleanor (patient) a..11 / d..01, Gina (doctor) a..01 / b..01, Priya (PA) a..03.
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

-- GoHighLevel contact link ------------------------------------------------------------------------

set local role service_role;
select lives_ok($$ select public.set_patient_ghl_contact('d0000000-0000-4000-8000-000000000001', 'ghl-contact-123') $$, 'the server records a patient''s GoHighLevel contact');
reset role;
select is((select ghl_contact_id from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), 'ghl-contact-123', 'and it is stored');
select is((select metadata ->> 'system' from public.audit_log where entity = 'patient_profiles' order by id desc limit 1), 'ghl-sync', 'logged as the ghl-sync job');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000003', $q$select public.set_patient_ghl_contact('d0000000-0000-4000-8000-000000000001', 'x')$q$) $$, '42501', null, 'a PA cannot set it');

-- Booking -----------------------------------------------------------------------------------------

-- An admin sets up a 30-minute type; Gina works Monday to Sunday 09:00 to 17:00 London time.
select is(t.run('a0000000-0000-4000-8000-000000000006', $q$insert into public.appointment_types (name, duration_min, location_kind) values ('Follow-up', 30, 'video')$q$), 1, 'an admin adds an appointment type');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000003', $q$insert into public.appointment_types (name, duration_min, location_kind) values ('Mine', 30, 'video')$q$) $$, '42501', null, 'a PA cannot');
select is(t.run('a0000000-0000-4000-8000-000000000003', $q$insert into public.clinician_availability (staff_id, weekday, start_time, end_time) select 'b0000000-0000-4000-8000-000000000001', d, '09:00', '17:00' from generate_series(1, 7) d$q$), 7, 'a PA sets a clinician''s hours');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000011', $q$insert into public.clinician_availability (staff_id, weekday, start_time, end_time) values ('b0000000-0000-4000-8000-000000000001', 1, '06:00', '07:00')$q$) $$, '42501', null, 'a patient cannot');

create temporary table slot on commit drop as
  select (((now() at time zone 'Europe/London')::date + 10)::timestamp + time '10:00') at time zone 'Europe/London' as at,
         (select id from public.appointment_types where name = 'Follow-up') as kind;
grant select on slot to authenticated;

-- Eleanor (Gina is on her care team) books with Gina.
select lives_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000011', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', (select kind from slot), (select at from slot))) $$,
  'a patient books with a clinician on her care team');
select is((select source::text || '/' || status::text from public.appointments where appointment_type_id = (select kind from slot)), 'clinic_hub/booked', 'the booking is saved');
select throws_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000003', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', (select kind from slot), (select at from slot) + interval '15 minutes')) $$,
  '23505', null, 'an overlapping booking is refused');
select throws_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000011', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', (select kind from slot), (select at from slot) + interval '8 hours')) $$,
  '22023', null, 'a time outside the clinician''s hours is refused');
select throws_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000011', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', (select kind from slot), (select at from slot) + interval '2 hours')) $$,
  '42501', null, 'a patient cannot book a clinician who does not look after her');
select throws_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000011', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', (select kind from slot), (select at from slot) + interval '3 hours')) $$,
  '42501', null, 'or book for another patient');
select lives_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000003', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', (select kind from slot), (select at from slot) + interval '1 hour')) $$,
  'a PA books for any patient');

-- Busy times show no patient details, and patients cannot cancel.
select is(t.n('a0000000-0000-4000-8000-000000000012', format('select * from public.clinician_busy(%L, now(), now() + interval ''30 days'') where starts_at = %L', 'b0000000-0000-4000-8000-000000000001', (select at from slot))), 1, 'another patient sees that the slot is busy');
select throws_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000011', format('select public.cancel_appointment(%L)', (select id from public.appointments where appointment_type_id = (select kind from slot) and patient_id = 'd0000000-0000-4000-8000-000000000001'))) $$,
  '42501', null, 'a patient cannot cancel');
select lives_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000003', format('select public.cancel_appointment(%L)', (select id from public.appointments where appointment_type_id = (select kind from slot) and patient_id = 'd0000000-0000-4000-8000-000000000001'))) $$,
  'a PA cancels');
select lives_ok(
  $$ select t.run('a0000000-0000-4000-8000-000000000011', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', (select kind from slot), (select at from slot))) $$,
  'and the freed slot can be booked again');

-- A patient sees only her own clinicians' busy times and hours, and never the past.
select is(t.n('a0000000-0000-4000-8000-000000000011', format('select * from public.clinician_busy(%L, now(), now() + interval ''30 days'')', 'b0000000-0000-4000-8000-000000000002')), 0, 'a patient cannot read the diary of a clinician who does not look after her');
select is(t.n('a0000000-0000-4000-8000-000000000011', format('select * from public.clinician_busy(%L, now() - interval ''400 days'', now() - interval ''1 day'')', 'b0000000-0000-4000-8000-000000000001')), 0, 'or any past appointments');
select is(t.n('a0000000-0000-4000-8000-000000000011', $q$select * from public.clinician_availability where staff_id = 'b0000000-0000-4000-8000-000000000002'$q$), 0, 'or another clinician''s hours');

select is(t.n('a0000000-0000-4000-8000-000000000011', $q$select * from public.get_bookable_clinicians('d0000000-0000-4000-8000-000000000001')$q$), 1, 'a patient sees the clinicians she can book');
select is(t.n('a0000000-0000-4000-8000-000000000012', $q$select * from public.get_bookable_clinicians('d0000000-0000-4000-8000-000000000001')$q$), 0, 'but not another patient''s');

-- A patient holds three open bookings at most: fill her up to three, then try once more.
insert into public.appointments (patient_id, clinician_id, starts_at, duration_min, type, status, source)
select 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', now() + make_interval(days => 40 + g), 30, 'Filler', 'booked', 'clinic_hub'
from generate_series(1, greatest(0, 3 - (select count(*)::int from public.appointments where patient_id = 'd0000000-0000-4000-8000-000000000001' and status in ('booked', 'confirmed') and starts_at > now()))) g;
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000011', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', (select kind from slot), (select at from slot) + interval '3 days')) $$, '22023', null, 'a patient with three open bookings cannot book a fourth');
select lives_ok($$ select t.run('a0000000-0000-4000-8000-000000000003', format('select public.book_appointment(%L, %L, %L, %L)', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', (select kind from slot), (select at from slot) + interval '3 days')) $$, 'but the team can book for her');

-- One GoHighLevel contact per patient.
set local role service_role;
select throws_ok($$ select public.set_patient_ghl_contact('d0000000-0000-4000-8000-000000000002', 'ghl-contact-123') $$, '23505', null, 'two patients never share a GoHighLevel contact');
reset role;

select * from finish();
rollback;
