-- Lab reports pushed by a provider: finding the patient, filing the file once, and matching a waiting file.
-- Ids from supabase/seed.sql: Eleanor (patient) a..11 / d..01, born 14 March 1974, eleanor.hart@example.test;
-- Thomas a..12 / d..02, born 2 February 1980; Priya (PA) a..03; Gina (doctor) a..01; admin a..06.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
end;
$$;

create temporary table made (name text primary key, id uuid);
grant all on made to authenticated, service_role;

-- 1. Finding the patient ---------------------------------------------------------------------------

select pg_temp.service();
select is(public.find_patient_for_lab('eleanor.hart@example.test', '1974-03-14'), 'd0000000-0000-4000-8000-000000000001'::uuid, 'the one patient with that email and date of birth is found');
select is(public.find_patient_for_lab('  ELEANOR.Hart@Example.Test ', '1974-03-14'), 'd0000000-0000-4000-8000-000000000001'::uuid, 'whatever the case or spaces');
select is(public.find_patient_for_lab('eleanor.hart@example.test', '1974-03-15'), null, 'a different date of birth finds nobody');
select is(public.find_patient_for_lab('nobody@example.test', '1974-03-14'), null, 'an unknown email finds nobody');
select is(public.find_patient_for_lab(null, '1974-03-14'), null, 'a missing email finds nobody');
select is(public.find_patient_for_lab('eleanor.hart@example.test', null), null, 'a missing date of birth finds nobody');
reset role;

-- The account email counts too, when the record has no contact email.
update public.patient_profiles set contact_email = null where id = 'd0000000-0000-4000-8000-000000000001';
select pg_temp.service();
select is(public.find_patient_for_lab('eleanor.hart@example.test', '1974-03-14'), 'd0000000-0000-4000-8000-000000000001'::uuid, 'the sign-in email of the account is used when there is no contact email');
reset role;

-- Two patients who share the email and the date of birth are never guessed between.
update public.patient_profiles set contact_email = 'eleanor.hart@example.test', date_of_birth = '1974-03-14' where id = 'd0000000-0000-4000-8000-000000000002';
select pg_temp.service();
select is(public.find_patient_for_lab('eleanor.hart@example.test', '1974-03-14'), null, 'two patients with the same email and date of birth match nobody');
reset role;
update public.patient_profiles set archived_at = now() where id = 'd0000000-0000-4000-8000-000000000002';
select pg_temp.service();
select is(public.find_patient_for_lab('eleanor.hart@example.test', '1974-03-14'), 'd0000000-0000-4000-8000-000000000001'::uuid, 'an archived record is left out');
reset role;

-- 2. Receiving a file ------------------------------------------------------------------------------

select pg_temp.service();
select lives_ok($$ insert into made select 'matched', import_id from public.receive_lab_file('acme-labs', 'R-1', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/lab-1.pdf', 'Blood panel', 'Eleanor Hart', 'eleanor.hart@example.test', '1974-03-14', '2026-11-10', 'Hormone panel') $$, 'a file for a matched patient is received');
select lives_ok($$ insert into made select 'waiting', import_id from public.receive_lab_file('acme-labs', 'R-2', null, 'unmatched/lab-2.pdf', 'Stool test', 'Someone Else', 'someone@example.test', '1990-01-01', null, 'Stool test') $$, 'a file for nobody is received too');
select is((select is_new from public.receive_lab_file('acme-labs', 'R-1', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/lab-1b.pdf', 'Blood panel', 'Eleanor Hart', 'eleanor.hart@example.test', '1974-03-14', null, null)), false, 'the same report sent again is not recorded twice');
select is((select import_id from public.receive_lab_file('acme-labs', 'R-1', 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/lab-1c.pdf', 'Blood panel', null, null, null, null, null)), (select id from made where name = 'matched'), 'and it returns the same import');
select throws_ok($$ select * from public.receive_lab_file('acme-labs', 'R-3', 'd0000000-0000-4000-8000-000000000001', 'unmatched/lab-3.pdf', 'x', null, null, null, null, null) $$, '23514', null, 'a file for a patient cannot sit under unmatched');
select throws_ok($$ select * from public.receive_lab_file('acme-labs', 'R-4', null, 'd0000000-0000-4000-8000-000000000001/lab-4.pdf', 'x', null, null, null, null, null) $$, '23514', null, 'nor an unmatched file under a patient');
select throws_ok($$ select * from public.receive_lab_file('Bad Lab!', 'R-5', null, 'unmatched/lab-5.pdf', 'x', null, null, null, null, null) $$, '22023', null, 'a lab name must be a short plain word');
select throws_ok($$ select * from public.receive_lab_file('acme-labs', '  ', null, 'unmatched/lab-6.pdf', 'x', null, null, null, null, null) $$, '22023', null, 'a report needs an id');
reset role;

select is((select status::text from public.result_imports where id = (select id from made where name = 'matched')), 'matched', 'the matched file waits for entry');
select is((select patient_id::text from public.result_imports where id = (select id from made where name = 'matched')), 'd0000000-0000-4000-8000-000000000001', 'under the patient');
select is((select status::text from public.result_imports where id = (select id from made where name = 'waiting')), 'needs_match', 'the other waits for a match');
select is((select source_name from public.result_imports where id = (select id from made where name = 'waiting')), 'Someone Else', 'with what the lab said, for a PA to read');
select is((select d.source::text from public.documents d join public.result_imports i on i.document_id = d.id where i.id = (select id from made where name = 'matched')), 'lab_feed', 'the document says it came from a lab');
select is((select d.shared_with_patient from public.documents d join public.result_imports i on i.document_id = d.id where i.id = (select id from made where name = 'matched')), false, 'and is not shared with the patient');
select is((select count(*)::int from public.webhook_events where source = 'lab_feed' and external_event_id like 'acme-labs:%'), 2, 'each report is stored as one event');
select is((select count(*)::int from public.webhook_events where source = 'lab_feed' and (payload ? 'email' or payload ? 'name' or payload ? 'date_of_birth')), 0, 'and the event holds no name, email or date');

-- 3. Matching a waiting file -----------------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.match_import_to_patient((select id from made where name = 'waiting'), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/lab-2.pdf') $$, '42501', null, 'a doctor cannot match a file');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ select public.match_import_to_patient((select id from made where name = 'waiting'), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/lab-2.pdf') $$, '42501', null, 'nor a patient');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.match_import_to_patient((select id from made where name = 'matched'), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/x.pdf') $$, '22023', null, 'only a file waiting for a match can be matched');
select throws_ok($$ select public.match_import_to_patient((select id from made where name = 'waiting'), gen_random_uuid(), 'x/lab-2.pdf') $$, '22023', null, 'a patient who does not exist is refused');
select throws_ok($$ select public.match_import_to_patient((select id from made where name = 'waiting'), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003/lab-2.pdf') $$, '22023', null, 'the file must be stored under that patient');
select lives_ok($$ select public.match_import_to_patient((select id from made where name = 'waiting'), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/lab-2.pdf') $$, 'a PA matches it');
select throws_ok($$ select public.match_import_to_patient((select id from made where name = 'waiting'), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001/lab-2b.pdf') $$, '22023', null, 'and only once');
reset role;
select is((select status::text from public.result_imports where id = (select id from made where name = 'waiting')), 'matched', 'the file is then matched');
select is((select d.patient_id::text from public.documents d join public.result_imports i on i.document_id = d.id where i.id = (select id from made where name = 'waiting')), 'd0000000-0000-4000-8000-000000000001', 'its document belongs to the patient');
select is((select d.storage_path from public.documents d join public.result_imports i on i.document_id = d.id where i.id = (select id from made where name = 'waiting')), 'd0000000-0000-4000-8000-000000000001/lab-2.pdf', 'and sits under the patient');

select ok(not has_function_privilege('authenticated', 'public.receive_lab_file(text, text, uuid, text, text, text, text, date, date, text)', 'execute'), 'a signed-in person cannot receive a lab file');
select ok(not has_function_privilege('authenticated', 'public.find_patient_for_lab(text, date)', 'execute'), 'nor look a patient up by email');
select ok(not has_function_privilege('anon', 'public.match_import_to_patient(uuid, uuid, text)', 'execute'), 'anon cannot match a file');

select * from finish();
rollback;
