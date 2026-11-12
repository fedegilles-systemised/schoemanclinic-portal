-- CQC audit trails: results sign-off and treatment options in notes. Ids from supabase/seed.sql:
-- Gina (doctor) a..01 / b..01, on Eleanor's (d..01) care team; Laura (doctor) a..02 / b..02;
-- Eleanor (patient) a..11; report 14..04 is Eleanor's, with no order; report 14..13 is d..04's,
-- ordered by Gina.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- Both doctors look after patient d..04 for this test.
select set_config('app.system_actor', 'cqc-test', true);
insert into public.care_team (patient_id, staff_id, relationship, since)
select 'd0000000-0000-4000-8000-000000000004', s, 'doctor', current_date - 1
from unnest(array['b0000000-0000-4000-8000-000000000001'::uuid, 'b0000000-0000-4000-8000-000000000002'::uuid]) s
where not exists (select 1 from public.care_team c where c.patient_id = 'd0000000-0000-4000-8000-000000000004' and c.staff_id = s);
select set_config('app.system_actor', '', true);

-- Sign-off is required, and an action needs describing.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.release_report('14000000-0000-4000-8000-000000000004', null) $$, '22023', null, 'a report is not released without a sign-off');
select throws_ok($$ select public.release_report('14000000-0000-4000-8000-000000000004', null, 'maybe') $$, '22023', null, 'the outcome is action or no action');
select throws_ok($$ select public.release_report('14000000-0000-4000-8000-000000000004', null, 'action', '  ') $$, '22023', null, 'an action must be described');
select lives_ok($$ select public.release_report('14000000-0000-4000-8000-000000000004', null, 'action', 'Repeat ferritin in six weeks.') $$, 'her doctor releases an external report, signed off with an action');
select is((select outcome || ':' || action_note from public.lab_report_signoffs where report_id = '14000000-0000-4000-8000-000000000004'), 'action:Repeat ferritin in six weeks.', 'the sign-off is recorded');
select is((select ordered_by from public.lab_report_signoffs where report_id = '14000000-0000-4000-8000-000000000004'), null, 'with no ordering doctor, as there was no order');
select is((select signed_by from public.lab_report_signoffs where report_id = '14000000-0000-4000-8000-000000000004'), 'b0000000-0000-4000-8000-000000000001'::uuid, 'signed by her');
reset role;

-- Another doctor signs off a report Gina ordered: allowed, and recorded.
select pg_temp.become('a0000000-0000-4000-8000-000000000002');
select lives_ok($$ select public.release_report('14000000-0000-4000-8000-000000000013', null, 'no_action') $$, 'another doctor on the care team signs off');
select is(
  (select signed_by::text || ' ' || ordered_by::text from public.lab_report_signoffs where report_id = '14000000-0000-4000-8000-000000000013'),
  'b0000000-0000-4000-8000-000000000002 b0000000-0000-4000-8000-000000000001',
  'the sign-off shows who signed and who ordered');
select is((select action_note from public.lab_report_signoffs where report_id = '14000000-0000-4000-8000-000000000013'), null, 'no action has no note');
reset role;

-- The patient never reads the sign-off; staff who can open the record do.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.lab_report_signoffs), 0, 'a patient reads no sign-off');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.lab_report_signoffs where patient_id = 'd0000000-0000-4000-8000-000000000001'), 1, 'her doctor reads it');
select throws_ok($$ insert into public.lab_report_signoffs (report_id, patient_id, outcome, signed_by) values ('14000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'no_action', 'b0000000-0000-4000-8000-000000000001') $$, '42501', null, 'nobody writes a sign-off directly');
reset role;

-- Nobody changes or removes a sign-off, not even the database owner.
select throws_ok($$ update public.lab_report_signoffs set outcome = 'no_action', action_note = null where report_id = '14000000-0000-4000-8000-000000000004' $$, '42501', null, 'a sign-off cannot be changed');
select throws_ok($$ delete from public.lab_report_signoffs where report_id = '14000000-0000-4000-8000-000000000004' $$, '42501', null, 'or removed');
select throws_ok($$ truncate public.lab_report_signoffs $$, '42501', null, 'or emptied');
select is((select count(*)::int from public.audit_log where entity = 'lab_report_signoffs'), 2, 'each sign-off is in the audit log');
select is((select count(*)::int from public.audit_log where entity = 'lab_report_signoffs' and entity_id = '14000000-0000-4000-8000-000000000004'), 1, 'under its report''s id');
select ok(not has_table_privilege('service_role', 'public.lab_report_signoffs', 'insert'), 'server code cannot write a sign-off either');

-- Treatment options in a note: set on the draft, fixed once signed.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select lives_ok($$
  insert into public.clinical_notes (patient_id, author_id, title, body, all_options_discussed, nice_options_discussed, options_offered)
  values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Options review', 'Discussed HRT.', true, true, 'Transdermal oestradiol; NICE NG23 options')
$$, 'a doctor records treatment options on a draft note');
select lives_ok($$ update public.clinical_notes set customised_options_discussed = true, side_effects_discussed = true where title = 'Options review' $$, 'and changes them while it is a draft');
select lives_ok($$ select public.sign_clinical_note((select id from public.clinical_notes where title = 'Options review')) $$, 'then signs the note');
select lives_ok($$ update public.clinical_notes set side_effects_discussed = false where title = 'Options review' $$, 'a change after signing reaches no row');
reset role;
select throws_ok($$ update public.clinical_notes set side_effects_discussed = false where title = 'Options review' $$, '42501', null, 'and even the owner cannot change a signed note');
select is(
  (select all_options_discussed and customised_options_discussed and nice_options_discussed and side_effects_discussed from public.clinical_notes where title = 'Options review'),
  true, 'so all four confirmations are kept');

select * from finish();
rollback;
