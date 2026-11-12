-- One record per person for online bookings. Ids from supabase/seed.sql: Eleanor (patient) d..01,
-- account a..11 (eleanor.hart@example.test); Gina (doctor) b..01; Laura (doctor) b..02.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become_server() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
  set local role service_role;
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
select s, d, '08:00', '20:00' from unnest(array['b0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid]) s, generate_series(1, 7) d;
select set_config('app.system_actor', '', true);

create temp table eleanor as select date_of_birth, first_name, last_name, clinic_ref from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001';
grant select on eleanor to service_role;
select is((select count(*)::int from public.patient_profiles), (select count(*)::int from public.patient_profiles), 'start');
create temp table before as select count(*)::int as n from public.patient_profiles;

-- An existing patient, by her sign-in email and date of birth, typing a different name: her own record, unchanged.
select pg_temp.become_server();
create temp table first_booking as
  select * from public.book_online('a7000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000002', pg_temp.slot(3, '10:00'), null,
    'Ellie', 'Hartley', (select date_of_birth from eleanor), 'Eleanor.Hart@Example.test', '07700 900555');
reset role;
select is((select patient_id from first_booking), 'd0000000-0000-4000-8000-000000000001'::uuid, 'an existing patient is booked on her own record');
select is((select count(*)::int from public.patient_profiles), (select n from before), 'no second record is made');
select is((select first_name || ' ' || last_name from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), (select first_name || ' ' || last_name from eleanor), 'and nothing typed changes it');
select ok((select booked_online_at is null from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), 'nor marks it as made online');
select ok(exists (select 1 from public.care_team where patient_id = 'd0000000-0000-4000-8000-000000000001' and staff_id = 'b0000000-0000-4000-8000-000000000002'), 'the doctor booked joins her care team');
select ok(exists (select 1 from public.notifications where body like 'An existing patient%'), 'the team is told it is an existing patient');

-- A new person books twice: one record.
select pg_temp.become_server();
create temp table new_one as select * from public.book_online('a7000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(4, '10:00'), null, 'Dan', 'Pike', '1985-03-03', 'dan@example.test', '07700 900666');
create temp table new_two as select * from public.book_online('a7000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(5, '10:00'), null, 'Dan', 'Pike', '1985-03-03', 'DAN@example.test', '07700 900666');
reset role;
select is((select patient_id from new_two), (select patient_id from new_one), 'a second online booking uses the first online record');

-- A shared email with a different date of birth is someone else.
select pg_temp.become_server();
create temp table family as select * from public.book_online('a7000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', pg_temp.slot(6, '10:00'), null, 'Jo', 'Lane', '1987-07-07', 'jo.lane@example.test', '07700 900777');
create temp table family_two as select * from public.book_online('a7000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000002', pg_temp.slot(6, '12:00'), null, 'Sam', 'Lane', '1989-09-09', 'jo.lane@example.test', '07700 900778');
reset role;
select isnt((select patient_id from family_two), (select patient_id from family), 'a family member sharing the email gets their own record');

select * from finish();
rollback;
