-- An online booking that makes a new record which may be someone already on the books: the team is told,
-- nothing is merged. Ids from supabase/seed.sql: Eleanor (patient) d..01, account a..11; Gina (doctor) b..01,
-- user a..01; Priya (PA) user a..03; admin user a..06.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become_server() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role service_role;
end;
$$;
create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.slot(_days integer, _hour text) returns timestamptz language sql security definer as $$
  select ((private.london_today() + _days)::text || ' ' || _hour)::timestamp at time zone 'Europe/London';
$$;
grant execute on function pg_temp.slot(integer, text) to service_role;

select set_config('app.system_actor', 'diary-test', true);
insert into public.appointment_types (id, name, duration_min, location_kind, bookable_online)
values ('a7000000-0000-4000-8000-000000000011', 'Initial consultation', 60, 'video', true);
insert into public.clinician_availability (staff_id, weekday, start_time, end_time)
select 'b0000000-0000-4000-8000-000000000001'::uuid, d, '08:00', '20:00' from generate_series(1, 7) d;
select set_config('app.system_actor', '', true);

create temp table eleanor as select first_name, last_name, date_of_birth, clinic_ref from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001';
grant select on eleanor to service_role;
create temp table before as select count(*)::int as n from public.patient_profiles;

-- 1. The same name and date of birth, a different email: a new record is made, and the team is told.
select pg_temp.become_server();
create temp table same_name as
  select * from public.book_online('a7000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(3, '10:00'), null,
    (select first_name from eleanor), (select last_name from eleanor), (select date_of_birth from eleanor), 'a.different.address@example.test', '07700 900123');
grant all on same_name to public;
reset role;
select is((select count(*)::int from public.patient_profiles), (select n + 1 from before), 'a record is still made: nothing is merged');
select is((select count(*)::int from private.find_possible_duplicates((select patient_id from same_name))), 1, 'the other record is found');
select is((select clinic_ref from private.find_possible_duplicates((select patient_id from same_name))), (select clinic_ref from eleanor), 'it is Eleanor''s');
select is((select reason from private.find_possible_duplicates((select patient_id from same_name))), 'The same name and date of birth', 'and the reason is given');
select ok(exists (select 1 from public.notifications where body like 'A new patient has booked online, and may already be on the clinic%'), 'the team is told it may be a duplicate');
select ok(not exists (select 1 from public.notifications where body like '%Eleanor%' or body like '%' || (select last_name from eleanor) || '%'), 'and the notice holds no name');

-- 2. The same name and email, a date of birth a day out: a typing slip.
select pg_temp.become_server();
create temp table typo as
  select * from public.book_online('a7000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(4, '10:00'), null,
    (select first_name from eleanor), (select last_name from eleanor), (select date_of_birth + 1 from eleanor), 'eleanor.hart@example.test', '07700 900124');
reset role;
select is((select reason from private.find_possible_duplicates((select patient_id from typo)) where clinic_ref = (select clinic_ref from eleanor)), 'The same name and email address', 'a slip in the date of birth is caught by the name and email');

-- 3. Someone unrelated: no warning.
select pg_temp.become_server();
create temp table stranger as
  select * from public.book_online('a7000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(5, '10:00'), null,
    'Zed', 'Quillfeather', '1971-02-02', 'zed.quillfeather@example.test', '07700 900999');
reset role;
select is((select count(*)::int from private.find_possible_duplicates((select patient_id from stranger))), 0, 'an unrelated new patient has no possible duplicate');
select ok(exists (select 1 from public.notifications where body = 'A new patient has booked online. Check their details and invite them to the portal.'), 'and gets the usual note');

-- 4. Who can ask.
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.possible_duplicates((select patient_id from same_name))), 1, 'a PA can see the possible duplicate');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select is((select count(*)::int from public.possible_duplicates((select patient_id from same_name))), 1, 'an admin can');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select * from public.possible_duplicates((select patient_id from same_name)) $$, '42501', null, 'a doctor cannot');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select * from public.possible_duplicates((select patient_id from same_name)) $$, '42501', null, 'a patient cannot');
select throws_ok($$ select * from private.find_possible_duplicates((select patient_id from same_name)) $$, '42501', null, 'nor call the matching directly');
reset role;
select pg_temp.become_server();
select throws_ok($$ select * from public.possible_duplicates((select patient_id from same_name)) $$, '42501', null, 'the public check is for signed-in staff, not the server');
reset role;

select * from finish();
rollback;
