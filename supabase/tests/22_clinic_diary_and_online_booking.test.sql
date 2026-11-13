-- The clinic diary, moving bookings and online booking. Ids from supabase/seed.sql: Gina (doctor)
-- a..01 / b..01; Laura (doctor) a..02 / b..02; Priya (PA) a..03; admin a..06; Nora (nurse) a..07;
-- Eleanor (patient) a..11.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.become_server() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role service_role;
end;
$$;
-- 10:00 London time, three days from now.
create function pg_temp.slot(_hour text default '10:00') returns timestamptz language sql security definer as $$
  select ((private.london_today() + 3)::text || ' ' || _hour)::timestamp at time zone 'Europe/London';
$$;
grant execute on function pg_temp.slot(text) to service_role, authenticated;

-- A type new patients may book online, and both doctors working every day from 08:00 to 20:00.
select set_config('app.system_actor', 'diary-test', true);
insert into public.appointment_types (id, name, duration_min, location_kind, bookable_online)
values ('a7000000-0000-4000-8000-000000000001', 'Initial consultation', 60, 'video', true),
       ('a7000000-0000-4000-8000-000000000002', 'Follow-up', 30, 'video', false);
insert into public.clinician_availability (staff_id, weekday, start_time, end_time)
select s, d, '08:00', '20:00' from unnest(array['b0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid]) s, generate_series(1, 7) d;
select set_config('app.system_actor', '', true);

-- Online booking: server only, with the checks.
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(), null, 'Ann', 'Lee', '1980-01-01', 'ann@example.test', '07700 900123') $$, '42501', null, 'a signed-in person cannot book online through the API');
reset role;
select pg_temp.become_server();
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(), null, 'Ann', 'Lee', '1980-01-01', 'ann@example.test', '07700 900123') $$, '22023', null, 'only types offered online');
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(), null, 'Ann', 'Lee', (current_date - 3650), 'ann@example.test', '07700 900123') $$, '22023', null, 'adults only');
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(), null, 'Ann', 'Lee', '1980-01-01', 'not an email', '07700 900123') $$, '22023', null, 'a valid email');
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', now() + interval '2 hours', null, 'Ann', 'Lee', '1980-01-01', 'ann@example.test', '07700 900123') $$, '22023', null, 'not within a day');
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot('21:00'), null, 'Ann', 'Lee', '1980-01-01', 'ann@example.test', '07700 900123') $$, '22023', null, 'inside the clinician''s hours');
create temp table booked as select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(), null, ' Ann ', 'Lee', '1980-01-01', 'Ann@Example.test', '07700 900123');
select is((select count(*)::int from booked), 1, 'a new patient books online');
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot('10:30'), null, 'Bob', 'Ray', '1975-05-05', 'bob@example.test', '07700 900124') $$, '23505', null, 'an overlapping time is refused');
select ok(exists (select 1 from public.online_busy('b0000000-0000-4000-8000-000000000001', now(), now() + interval '7 days')), 'the server sees the clinician busy, without names');
select is((select count(*)::int from public.online_booking_clinicians() where staff_id = 'b0000000-0000-4000-8000-000000000001'), 1, 'the server lists clinicians with hours');
reset role;
grant select on booked to authenticated;

select is((select first_name || ' ' || last_name || ' ' || contact_email from public.patient_profiles where id = (select patient_id from booked)), 'Ann Lee ann@example.test', 'the record is made with tidied details');
select ok((select booked_online_at is not null and user_id is null from public.patient_profiles where id = (select patient_id from booked)), 'marked as booked online, with no account');
select ok((select booked_online and source = 'clinic_hub' and booked_by is null from public.appointments where id = (select appointment_id from booked)), 'the appointment is marked as booked online');
select ok(exists (select 1 from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000003' and link = '/clinic/diary/' || (select appointment_id from booked)), 'a PA is told');
select is((select metadata ->> 'system' from public.audit_log where entity = 'appointments' and entity_id = (select appointment_id from booked) limit 1), 'online-booking', 'in the audit log as the online booking job');
select ok(not has_function_privilege('anon', 'public.book_online(uuid, uuid, timestamptz, uuid, text, text, date, text, text)', 'execute'), 'nobody signed out calls it directly');

-- Two open online bookings per email at most.
select pg_temp.become_server();
select lives_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot('12:00'), null, 'Ann', 'Lee', '1980-01-01', 'ann@example.test', '07700 900123') $$, 'a second booking');
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot('14:00'), null, 'Ann', 'Lee', '1980-01-01', 'ann@example.test', '07700 900123') $$, '22023', null, 'but not a third');
reset role;

-- The diary: admins and PAs read every clinician's bookings with names; a clinician reads only their own.
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select is((select patient_name from public.clinic_diary(now(), now() + interval '7 days') where id = (select appointment_id from booked)), 'Ann Lee', 'a PA sees the booking with the name');
select is((select new_patient from public.clinic_diary(now(), now() + interval '7 days') where id = (select appointment_id from booked)), true, 'it shows as a new patient');
select throws_ok($$ select * from public.clinic_diary(now(), now() + interval '60 days') $$, '22023', null, 'six weeks at most');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.clinic_diary(now(), now() + interval '7 days') where id = (select appointment_id from booked)), 1, 'the doctor booked sees her own booking');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from public.clinic_diary(now(), now() + interval '7 days') where id = (select appointment_id from booked)), 0, 'another doctor does not');
select is((select count(*)::int from public.clinic_diary(now(), now() + interval '7 days') where clinician_id is distinct from 'b0000000-0000-4000-8000-000000000002'), 0, 'a doctor sees only her own bookings');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000007');
select is((select count(*)::int from public.clinic_diary(now(), now() + interval '7 days')), 0, 'a nurse with no bookings sees none');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select * from public.clinic_diary(now(), now() + interval '7 days') $$, '42501', null, 'a patient does not');
reset role;

-- Moving: within hours, no overlap, by the team for patients they can open.
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select throws_ok($$ select public.move_appointment((select appointment_id from booked), 'b0000000-0000-4000-8000-000000000002', pg_temp.slot('15:00')) $$, '42501', null, 'a doctor outside the care team cannot move it');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.move_appointment((select appointment_id from booked), 'b0000000-0000-4000-8000-000000000001', pg_temp.slot('12:30')) $$, '23505', null, 'not onto another booking');
select throws_ok($$ select public.move_appointment((select appointment_id from booked), 'b0000000-0000-4000-8000-000000000001', pg_temp.slot('19:30')) $$, '22023', null, 'not past the clinician''s hours');
select lives_ok($$ select public.move_appointment((select appointment_id from booked), 'b0000000-0000-4000-8000-000000000002', pg_temp.slot('15:00')) $$, 'a PA moves it to another doctor and time');
reset role;
select is((select clinician_id from public.appointments where id = (select appointment_id from booked)), 'b0000000-0000-4000-8000-000000000002'::uuid, 'the clinician changed');
select is((select starts_at from public.appointments where id = (select appointment_id from booked)), pg_temp.slot('15:00'), 'and the time');

-- The booked clinician joins the new patient's care team; a confirmed booking stays confirmed when moved.
select ok(exists (select 1 from public.care_team where patient_id = (select patient_id from booked) and staff_id = 'b0000000-0000-4000-8000-000000000001' and relationship = 'doctor'), 'the doctor booked joins the care team');
select set_config('app.system_actor', 'diary-test', true);
update public.appointments set status = 'confirmed' where id = (select appointment_id from booked);
select set_config('app.system_actor', '', true);
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select lives_ok($$ select public.move_appointment((select appointment_id from booked), 'b0000000-0000-4000-8000-000000000002', pg_temp.slot('16:00')) $$, 'a confirmed booking is moved');
reset role;
select is((select status::text from public.appointments where id = (select appointment_id from booked)), 'confirmed', 'and stays confirmed');
select ok(exists (select 1 from public.care_team where patient_id = (select patient_id from booked) and staff_id = 'b0000000-0000-4000-8000-000000000002'), 'the clinician it moved to joins the care team');

-- The same phone number counts towards the limit, whatever the email; the message names nobody.
select pg_temp.become_server();
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', pg_temp.slot('09:00'), null, 'Someone', 'Else', '1970-02-02', 'other@example.test', '07700 900123') $$, '22023', 'We cannot take this booking online. Please contact the clinic.', 'the same phone number cannot book a third time');
select throws_ok($$ select * from public.book_online('a7000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', now() + interval '40 days', null, 'Cara', 'Moss', '1970-02-02', 'cara@example.test', '07700 900999') $$, '22023', null, 'not beyond the three weeks offered');
reset role;

-- A cancelled booking leaves the diary.
select set_config('app.system_actor', 'diary-test', true);
update public.appointments set status = 'cancelled' where id = (select appointment_id from booked);
select set_config('app.system_actor', '', true);
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.clinic_diary(now(), now() + interval '7 days') where id = (select appointment_id from booked)), 0, 'a cancelled booking is not in the diary');
reset role;

select * from finish();
rollback;
