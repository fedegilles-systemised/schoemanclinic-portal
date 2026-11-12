-- The education builder and player. Ids from supabase/seed.sql: Gina (doctor) a..01 / b..01, on
-- Eleanor's (d..01) care team; admin a..06 / b..06; Eleanor (patient) a..11; Thomas (patient) a..12.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- A published course with two sections and three lessons, one of them a draft, given to Eleanor.
select set_config('app.system_actor', 'education-test', true);
insert into public.education_courses (id, title, created_by, published) values
  ('e2000000-0000-4000-8000-000000000001', 'Hormones explained', 'b0000000-0000-4000-8000-000000000006', true);
insert into public.education_sections (id, course_id, title, position) values
  ('e2100000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'Basics', 0),
  ('e2100000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'Treatment', 1);
insert into public.education_modules (id, section_id, title, content, published, position) values
  ('e2200000-0000-4000-8000-000000000001', 'e2100000-0000-4000-8000-000000000001', 'What hormones do', '{"type": "doc", "content": []}', true, 0),
  ('e2200000-0000-4000-8000-000000000002', 'e2100000-0000-4000-8000-000000000001', 'Oestrogen', null, true, 1),
  ('e2200000-0000-4000-8000-000000000003', 'e2100000-0000-4000-8000-000000000002', 'Still being written', null, false, 0);
insert into public.education_assignments (course_id, patient_id, assigned_by) values
  ('e2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
insert into public.education_files (id, module_id, storage_path, file_name, content_type, size_bytes, created_by) values
  ('e2300000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000001', 'files/e2200000-0000-4000-8000-000000000001/e2300000-0000-4000-8000-000000000001.pdf', 'Handout.pdf', 'application/pdf', 1000, 'b0000000-0000-4000-8000-000000000006'),
  ('e2300000-0000-4000-8000-000000000002', 'e2200000-0000-4000-8000-000000000003', 'files/e2200000-0000-4000-8000-000000000003/e2300000-0000-4000-8000-000000000002.pdf', 'Draft handout.pdf', 'application/pdf', 1000, 'b0000000-0000-4000-8000-000000000006');
select set_config('app.system_actor', '', true);

-- The patient reads published lessons and their files only; another patient reads none.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.education_modules m join public.education_sections s on s.id = m.section_id where s.course_id = 'e2000000-0000-4000-8000-000000000001'), 2, 'the patient reads the two published lessons');
select is((select count(*)::int from public.education_files where module_id in ('e2200000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000003')), 1, 'and only the published lesson''s file');
select ok(private.can_read_education_object('files/e2200000-0000-4000-8000-000000000001/e2300000-0000-4000-8000-000000000001.pdf'), 'she may download the published handout');
select ok(not private.can_read_education_object('files/e2200000-0000-4000-8000-000000000003/e2300000-0000-4000-8000-000000000002.pdf'), 'but not the draft''s');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select is((select count(*)::int from public.education_modules m join public.education_sections s on s.id = m.section_id where s.course_id = 'e2000000-0000-4000-8000-000000000001'), 0, 'another patient reads no lessons of a course not given to him');
select ok(not private.can_read_education_object('files/e2200000-0000-4000-8000-000000000001/e2300000-0000-4000-8000-000000000001.pdf'), 'nor its files');
reset role;

-- Progress: the patient marks a published lesson complete, once, for herself only.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select lives_ok($$ insert into public.education_progress (patient_id, module_id, completed_by) values ('d0000000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011') $$, 'the patient completes a lesson');
select throws_ok($$ insert into public.education_progress (patient_id, module_id, completed_by) values ('d0000000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011') $$, '23505', null, 'once');
select throws_ok($$ insert into public.education_progress (patient_id, module_id, completed_by) values ('d0000000-0000-4000-8000-000000000001', 'e2200000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000011') $$, '42501', null, 'not a draft lesson');
select throws_ok($$ insert into public.education_progress (patient_id, module_id, completed_by) values ('d0000000-0000-4000-8000-000000000002', 'e2200000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011') $$, '42501', null, 'and not for another patient');
select throws_ok($$ update public.education_progress set completed_at = now() $$, '42501', null, 'progress cannot be changed');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.education_progress where patient_id = 'd0000000-0000-4000-8000-000000000001'), 1, 'her doctor reads her progress');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select is((select count(*)::int from public.education_progress), 0, 'another patient does not');
reset role;

-- Reordering: admins only, with every section and lesson named once.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.reorder_course('e2000000-0000-4000-8000-000000000001', '[]') $$, '42501', null, 'a doctor cannot reorder a course');
update public.education_modules set published = false where id = 'e2200000-0000-4000-8000-000000000001';
reset role;
select ok((select published from public.education_modules where id = 'e2200000-0000-4000-8000-000000000001'), 'nor change a lesson (the update reaches no row)');
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000006');
select throws_ok($$ select public.reorder_course('e2000000-0000-4000-8000-000000000001', '[{"section": "e2100000-0000-4000-8000-000000000001", "lessons": ["e2200000-0000-4000-8000-000000000001"]}]') $$, '40001', null, 'an order that leaves something out is refused');
select lives_ok($$ select public.reorder_course('e2000000-0000-4000-8000-000000000001',
  '[{"section": "e2100000-0000-4000-8000-000000000002", "lessons": ["e2200000-0000-4000-8000-000000000002", "e2200000-0000-4000-8000-000000000003"]},
    {"section": "e2100000-0000-4000-8000-000000000001", "lessons": ["e2200000-0000-4000-8000-000000000001"]}]') $$, 'an admin reorders, moving a lesson to another section');
select is((select position from public.education_sections where id = 'e2100000-0000-4000-8000-000000000002'), 0, 'the second section comes first');
select is((select section_id::text || ':' || position from public.education_modules where id = 'e2200000-0000-4000-8000-000000000002'), 'e2100000-0000-4000-8000-000000000002:0', 'the lesson moved to the top of the other section');
select lives_ok($$ update public.education_modules set content = '{"type": "doc", "content": [{"type": "paragraph"}]}', published = true where id = 'e2200000-0000-4000-8000-000000000003' $$, 'an admin edits and publishes a lesson');
select throws_ok($$ update public.education_modules set content = '"text"' where id = 'e2200000-0000-4000-8000-000000000003' $$, '23514', null, 'content must be a document');
select lives_ok($$ update public.education_files set archived_at = now() where id = 'e2300000-0000-4000-8000-000000000002' $$, 'an admin archives a file');
select throws_ok($$ delete from public.education_files where id = 'e2300000-0000-4000-8000-000000000002' $$, '42501', null, 'files are not deleted');
select throws_ok($$ update public.education_courses set cover_path = 'courses/e2000000-0000-4000-8000-000000000099/cover-e2300000-0000-4000-8000-000000000009.png' where id = 'e2000000-0000-4000-8000-000000000001' $$, '23514', null, 'a cover must sit under its own course');
select lives_ok($$ update public.education_courses set cover_path = 'courses/e2000000-0000-4000-8000-000000000001/cover-e2300000-0000-4000-8000-000000000009.png' where id = 'e2000000-0000-4000-8000-000000000001' $$, 'a cover under the course is accepted');
reset role;

-- The patient now reads the published lesson and the cover; a nurse who is not staff for reading the library does not upload.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select ok(private.can_read_education_object('courses/e2000000-0000-4000-8000-000000000001/cover-e2300000-0000-4000-8000-000000000009.png'), 'the patient may see the cover of her course');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select ok(not private.can_read_education_object('courses/e2000000-0000-4000-8000-000000000001/cover-e2300000-0000-4000-8000-000000000009.png'), 'another patient may not');
reset role;

select ok(not has_function_privilege('anon', 'public.reorder_course(uuid, jsonb)', 'execute'), 'nobody signed out reorders');
select ok(exists (select 1 from public.audit_log where entity = 'education_progress'), 'progress is in the audit log');

select * from finish();
rollback;
