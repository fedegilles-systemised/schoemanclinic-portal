-- Education courses and wearable readings (decided 11 November 2026). Ids from supabase/seed.sql:
-- admin a..06 / b..06, Gina (doctor) a..01 / b..01, Eleanor (patient) a..11 / d..01, Thomas (patient) a..12 / d..02.
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

-- Building a course ---------------------------------------------------------------------------

select is(t.run('a0000000-0000-4000-8000-000000000006', $q$insert into public.education_courses (title, created_by) values ('Admin made', 'b0000000-0000-4000-8000-000000000006')$q$), 1, 'an admin creates a course');
-- A fixed course and section for the rest of the file.
insert into public.education_courses (id, title, created_by) values ('e1000000-0000-4000-8000-000000000001', 'Sleep basics', 'b0000000-0000-4000-8000-000000000006');
select is(t.run('a0000000-0000-4000-8000-000000000006', $q$insert into public.education_sections (course_id, title) values ('e1000000-0000-4000-8000-000000000001', 'Week 1')$q$), 1, 'and a section');
update public.education_sections set id = 'e2000000-0000-4000-8000-000000000001' where title = 'Week 1';
select is(t.run('a0000000-0000-4000-8000-000000000006', $q$insert into public.education_modules (section_id, title, body, video_url, published) values ('e2000000-0000-4000-8000-000000000001', 'Light', 'Morning light.', 'https://example.test/video', true)$q$), 1, 'and a module with a video link');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000006', $q$insert into public.education_modules (section_id, title, video_url) values ('e2000000-0000-4000-8000-000000000001', 'Bad', 'javascript:alert(1)')$q$) $$, '23514', null, 'a video link must be https');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000001', $q$insert into public.education_courses (title, created_by) values ('Mine', 'b0000000-0000-4000-8000-000000000001')$q$) $$, '42501', null, 'a doctor cannot create courses');
select is(t.n('a0000000-0000-4000-8000-000000000001', 'select * from public.education_courses'), 2, 'but reads the library');

-- Assigning ----------------------------------------------------------------------------------

select is(t.run('a0000000-0000-4000-8000-000000000001', $q$insert into public.education_assignments (course_id, patient_id, assigned_by) values ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001')$q$), 1, 'a doctor assigns a course to her patient');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000002', $q$insert into public.education_assignments (course_id, patient_id, assigned_by) values ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002')$q$) $$, '42501', null, 'but not to someone else''s patient');

select is(t.n('a0000000-0000-4000-8000-000000000011', 'select * from public.education_courses'), 0, 'the patient does not see an unpublished course');
select is(t.run('a0000000-0000-4000-8000-000000000006', $q$update public.education_courses set published = true where id = 'e1000000-0000-4000-8000-000000000001'$q$), 1, 'the admin publishes it');
select is(t.n('a0000000-0000-4000-8000-000000000011', 'select * from public.education_courses'), 1, 'and the patient now sees it');
select is(t.n('a0000000-0000-4000-8000-000000000011', 'select * from public.education_modules'), 1, 'with its modules');
select is(t.n('a0000000-0000-4000-8000-000000000012', 'select * from public.education_courses'), 0, 'another patient does not');
select is(t.run('a0000000-0000-4000-8000-000000000011', $q$update public.education_courses set title = 'Hacked'$q$), 0, 'a patient cannot change a course');

-- Wearables ----------------------------------------------------------------------------------

select is(t.run('a0000000-0000-4000-8000-000000000011', $q$insert into public.wearable_readings (patient_id, metric, value, measured_on, device, entered_by) values ('d0000000-0000-4000-8000-000000000001', 'hrv_ms', 48, current_date, 'Oura', 'a0000000-0000-4000-8000-000000000011')$q$), 1, 'a patient enters a reading');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000011', $q$insert into public.wearable_readings (patient_id, metric, value, measured_on, entered_by) values ('d0000000-0000-4000-8000-000000000002', 'steps', 100, current_date, 'a0000000-0000-4000-8000-000000000011')$q$) $$, '42501', null, 'but not for another patient');
select is(t.n('a0000000-0000-4000-8000-000000000001', 'select * from public.wearable_readings'), 1, 'her doctor reads it');
select is(t.n('a0000000-0000-4000-8000-000000000002', 'select * from public.wearable_readings'), 0, 'another doctor does not');
select is(t.n('a0000000-0000-4000-8000-000000000012', 'select * from public.wearable_readings'), 0, 'nor does another patient');
select is(t.run('a0000000-0000-4000-8000-000000000011', $q$update public.wearable_readings set archived_at = now()$q$), 1, 'the patient archives a mistaken reading');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000011', 'delete from public.wearable_readings') $$, '42501', null, 'a patient cannot delete a reading');
set local role service_role;
select throws_ok($$ delete from public.wearable_readings $$, '42501', null, 'nor can the server');
reset role;

select * from finish();
rollback;
