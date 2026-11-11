-- Call recordings: clinicians record their own patients' calls; the transcript becomes a draft note in
-- the recorder's name, once; patients never see recordings. Ids from supabase/seed.sql:
-- Gina (doctor) a..01 / b..01 looks after Eleanor d..01; Laura (doctor) a..02 / b..02 does not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into public.call_recordings (patient_id, recorded_by, storage_path) values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/call.webm') $$,
  'a doctor records her patient''s call');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('recordings', 'd0000000-0000-4000-8000-000000000001/call.webm') $$,
  'and uploads the audio to the patient''s folder');
reset role;

select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ insert into public.call_recordings (patient_id, recorded_by, storage_path) values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001/other.webm') $$,
  '42501', null, 'a doctor cannot record a patient she does not look after');
select is((select count(*)::int from storage.objects where bucket_id = 'recordings'), 0, 'or hear their recordings');
reset role;

select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ insert into public.call_recordings (patient_id, recorded_by, storage_path) values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001/pa.webm') $$,
  '42501', null, 'a PA does not record calls');
select is((select count(*)::int from public.call_recordings), 1, 'but reads the recordings of patients she can open');
reset role;

select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.call_recordings), 0, 'the patient sees no recording');
select is((select count(*)::int from storage.objects where bucket_id = 'recordings'), 0, 'and no audio');
reset role;

select throws_ok(
  $$ select pg_temp.become('a0000000-0000-4000-8000-000000000001'); select public.recording_transcribed((select id from public.call_recordings limit 1), 'x', 'y') $$,
  '42501', null, 'only the server delivers a transcript');
reset role;

-- The server sends it for transcription and the transcript arrives as a draft in Gina's name.
create temporary table rec on commit drop as select id from public.call_recordings limit 1;
grant select on rec to service_role;
-- The server has no signed-in person: the audit log must take the recorder from the function.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select lives_ok($$ select public.recording_sent((select id from rec), 'job-1') $$, 'the server marks it as sent for transcription');
select lives_ok($$ select public.recording_transcribed((select id from rec), 'Call transcript', 'Speaker A: Hello.') $$, 'and saves the transcript');
select lives_ok($$ select public.recording_transcribed((select id from rec), 'Call transcript', 'Speaker A: Hello.') $$, 'a second delivery does nothing');
reset role;
select is((select count(*)::int from public.clinical_notes where source = 'recording'), 1, 'one draft note, once');
select is(
  (select n.status::text || '/' || (n.author_id = 'b0000000-0000-4000-8000-000000000001')::text from public.clinical_notes n where n.source = 'recording'),
  'draft/true', 'a draft in the recorder''s name, to check and sign');
select is((select actor_id from public.audit_log where entity = 'clinical_notes' order by id desc limit 1), 'a0000000-0000-4000-8000-000000000001'::uuid, 'logged under the recorder');
select is((select status::text from public.call_recordings where id = (select id from rec)), 'transcribed', 'and the recording is marked done');

select * from finish();
rollback;
