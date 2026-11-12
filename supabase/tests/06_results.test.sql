-- Results: entering, converting, flagging and releasing. Fixed ids come from supabase/seed.sql.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create schema t;

create function t.become(_user uuid) returns void language plpgsql as $$
begin
  if _user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end;
$$;

-- Runs a statement as someone and gives back its single value as text, then returns to postgres.
create function t.val(_user uuid, _sql text) returns text language plpgsql as $$
declare result text;
begin
  perform t.become(_user);
  execute _sql into result;
  reset role;
  return result;
end;
$$;

grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to anon, authenticated;

select set_config('app.system_actor', 'results-test', true);

-- Priya is a PA, Gina a doctor, Eleanor and Thomas patients, Cecile the coach.
create function t.priya() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000003'::uuid $$;
create function t.tom() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000004'::uuid $$;
create function t.gina() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.admin() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000006'::uuid $$;
create function t.coach() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000005'::uuid $$;
create function t.eleanor() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000011'::uuid $$;
create function t.thomas() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000012'::uuid $$;
create function t.p_eleanor() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-000000000001'::uuid $$;

create function t.m(_code text) returns uuid language sql as $$ select id from public.markers where code = _code $$;
grant execute on function t.m(text) to authenticated;

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- Entering ------------------------------------------------------------------------------------------

insert into ids
select 'r1', t.val(t.priya(), format($q$
  select public.enter_report(%L, '2026-10-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 400, 'unit', 'ng/dL'),
    jsonb_build_object('marker_id', t.m('LDL'), 'value', 4.0, 'unit', 'mmol/L'),
    jsonb_build_object('marker_id', t.m('HBA1C'), 'value', 5.6, 'unit', '%%'),
    jsonb_build_object('marker_id', t.m('TSH'), 'value', 0.41)
  ), 'Test lab')
$q$, t.p_eleanor()))::uuid;

select is((select count(*)::int from public.results where lab_report_id = (select id from ids where name = 'r1')), 4, 'a PA enters a report with four results');
select is((select status::text from public.lab_reports where id = (select id from ids where name = 'r1')), 'awaiting_review', 'which waits for a doctor');
select is((select value_numeric from public.results where lab_report_id = (select id from ids where name = 'r1') and marker_id = t.m('TESTO')), 13.868::numeric, 'testosterone is converted from ng/dL to nmol/L');
select is((select original_value from public.results where lab_report_id = (select id from ids where name = 'r1') and marker_id = t.m('TESTO')), 400::numeric, 'and the original value is kept');
select is((select original_unit from public.results where lab_report_id = (select id from ids where name = 'r1') and marker_id = t.m('TESTO')), 'ng/dL', 'with its unit');
select is((select flag::text from public.results where lab_report_id = (select id from ids where name = 'r1') and marker_id = t.m('TESTO')), 'normal', 'a value inside its range is normal');
select is((select flag::text from public.results where lab_report_id = (select id from ids where name = 'r1') and marker_id = t.m('LDL')), 'high', 'a value above the limit is high');
select is((select value_numeric from public.results where lab_report_id = (select id from ids where name = 'r1') and marker_id = t.m('HBA1C')), 37.7054::numeric, 'HbA1c is converted from % to mmol/mol');
select is((select flag::text from public.results where lab_report_id = (select id from ids where name = 'r1') and marker_id = t.m('TSH')), 'borderline', 'a value just inside its range is borderline');
select is((select original_value from public.results where lab_report_id = (select id from ids where name = 'r1') and marker_id = t.m('LDL')), null, 'a value already in the marker''s unit has no original');

select throws_ok($$ select t.val(t.priya(), format($q$ select public.enter_report(%L, '2026-10-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 12, 'unit', 'furlongs'))) $q$, t.p_eleanor())) $$, '22023', null, 'an unknown unit is refused');
select throws_ok($$ select t.val(t.priya(), format($q$ select public.enter_report(%L, '2026-10-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 12), jsonb_build_object('marker_id', t.m('TESTO'), 'value', 13))) $q$, t.p_eleanor())) $$, '22023', null, 'the same marker twice is refused');
select throws_ok($$ select t.val(t.priya(), format($q$ select public.enter_report(%L, '2026-10-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 'abc'))) $q$, t.p_eleanor())) $$, '22023', null, 'a value that is not a number is refused');
select throws_ok($$ select t.val(t.priya(), format($q$ select public.enter_report(%L, '2999-01-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 12))) $q$, t.p_eleanor())) $$, '22023', null, 'a sample date in the future is refused');
select throws_ok($$ select t.val(t.priya(), format($q$ select public.enter_report(%L, '2026-10-01', '[]'::jsonb) $q$, t.p_eleanor())) $$, '22023', null, 'an empty report is refused');

select throws_ok($$ select t.val(t.eleanor(), format($q$ select public.enter_report(%L, '2026-10-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 12))) $q$, t.p_eleanor())) $$, '42501', null, 'a patient cannot enter results');
select throws_ok($$ select t.val(t.coach(), format($q$ select public.enter_report(%L, '2026-10-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 12))) $q$, t.p_eleanor())) $$, '42501', null, 'neither can the health coach');
select throws_ok($$ select t.val(t.admin(), format($q$ select public.enter_report(%L, '2026-10-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 12))) $q$, t.p_eleanor())) $$, '42501', null, 'neither can an admin');
select throws_ok($$ select t.val(null, format($q$ select public.enter_report(%L, '2026-10-01', jsonb_build_array(
    jsonb_build_object('marker_id', t.m('TESTO'), 'value', 12))) $q$, t.p_eleanor())) $$, '42501', null, 'nor can someone signed out');

-- Releasing -----------------------------------------------------------------------------------------

select is(t.val(t.eleanor(), format('select count(*) from public.lab_reports where id = %L', (select id from ids where name = 'r1'))), '0', 'the patient cannot see the report yet');
select is(t.val(t.eleanor(), format('select count(*) from public.results where lab_report_id = %L', (select id from ids where name = 'r1'))), '0', 'or its results');
select throws_ok($$ select t.val(t.priya(), format('select public.release_report(%L)', (select id from ids where name = 'r1'))) $$, '42501', null, 'a PA cannot release');
select throws_ok($$ select t.val(t.eleanor(), format('select public.release_report(%L)', (select id from ids where name = 'r1'))) $$, '42501', null, 'a patient cannot release');
select throws_ok($$ select t.val(t.gina(), format($q$ select public.release_report(%L, 'Looks fine.')::text $q$, (select id from ids where name = 'r1'))) $$, '22023', null, 'a report is not released without a sign-off');
select lives_ok($$ select t.val(t.gina(), format($q$ select public.release_report(%L, 'Looks fine.', 'no_action')::text $q$, (select id from ids where name = 'r1'))) $$, 'a doctor releases it, signed off with no action');
select is((select status::text from public.lab_reports where id = (select id from ids where name = 'r1')), 'released', 'the report is released');
select is((select (released_at is not null and reviewed_at is not null and reviewed_by is not null) from public.lab_reports where id = (select id from ids where name = 'r1')), true, 'with who and when');
select is(t.val(t.eleanor(), format('select count(*) from public.results where lab_report_id = %L', (select id from ids where name = 'r1'))), '4', 'now the patient sees all four results');
select is(t.val(t.eleanor(), format('select patient_comment from public.lab_reports where id = %L', (select id from ids where name = 'r1'))), 'Looks fine.', 'and the doctor''s comment');
select is(t.val(t.thomas(), format('select count(*) from public.results where lab_report_id = %L', (select id from ids where name = 'r1'))), '0', 'another patient sees nothing');
select is((select count(*)::int from public.notifications where user_id = t.eleanor() and title = 'Your results are ready' and created_at = now()), 1, 'the patient is told');
select throws_ok($$ select t.val(t.gina(), format('select public.release_report(%L)', (select id from ids where name = 'r1'))) $$, '23505', null, 'a report cannot be released twice');

-- Files waiting for entry -----------------------------------------------------------------------------

insert into public.documents (id, patient_id, kind, title, storage_path, source, uploaded_by, shared_with_patient)
values ('f0000000-0000-4000-8000-000000000001', t.p_eleanor(), 'lab_report', 'Scan', 'd0000000-0000-4000-8000-000000000001/f1.pdf', 'staff_upload', t.priya(), false),
       ('f0000000-0000-4000-8000-000000000002', t.p_eleanor(), 'patient_upload', 'My bloods', 'd0000000-0000-4000-8000-000000000001/f2.pdf', 'patient_upload', t.eleanor(), true);

select lives_ok($$ select t.val(t.priya(), $q$ select public.register_import('f0000000-0000-4000-8000-000000000001')::text $q$) $$, 'a PA registers a scanned file');
select is((select status::text from public.result_imports where document_id = 'f0000000-0000-4000-8000-000000000001'), 'matched', 'which is already filed under the patient');
select throws_ok($$ select t.val(t.priya(), $q$ select public.register_import('f0000000-0000-4000-8000-000000000001')::text $q$) $$, '23505', null, 'the same file cannot be registered twice');
select throws_ok($$ select t.val(t.thomas(), $q$ select public.register_import('f0000000-0000-4000-8000-000000000002')::text $q$) $$, '42501', null, 'a patient cannot register another patient''s file');
select lives_ok($$ select t.val(t.eleanor(), $q$ select public.register_import('f0000000-0000-4000-8000-000000000002')::text $q$) $$, 'a patient registers her own upload');
select is((select status::text from public.result_imports where document_id = 'f0000000-0000-4000-8000-000000000002'), 'matched', 'which is already matched to her');

insert into ids
select 'r2', t.val(t.priya(), format($q$
  select public.enter_report(%L, '2026-10-05', jsonb_build_array(jsonb_build_object('marker_id', t.m('TSH'), 'value', 2.0)),
    'Scan lab', 'f0000000-0000-4000-8000-000000000001', %L)
$q$, t.p_eleanor(), (select id from public.result_imports where document_id = 'f0000000-0000-4000-8000-000000000001')))::uuid;

select is((select status::text from public.result_imports where document_id = 'f0000000-0000-4000-8000-000000000001'), 'confirmed', 'entering the values confirms the import');
select throws_ok($$ select t.val(t.priya(), format($q$
  select public.enter_report(%L, '2026-10-05', jsonb_build_array(jsonb_build_object('marker_id', t.m('TSH'), 'value', 2.0)),
    'Scan lab', 'f0000000-0000-4000-8000-000000000001', %L) $q$, t.p_eleanor(), (select id from public.result_imports where document_id = 'f0000000-0000-4000-8000-000000000001'))) $$, '23505', null, 'an import is dealt with once');

select throws_ok($$ select t.val(t.priya(), format($q$
  select public.enter_report('d0000000-0000-4000-8000-000000000002', '2026-10-05', jsonb_build_array(jsonb_build_object('marker_id', t.m('TSH'), 'value', 2.0)),
    null, null, %L) $q$, (select id from public.result_imports where document_id = 'f0000000-0000-4000-8000-000000000002'))) $$, '22023', 'That file belongs to another patient.', 'an import cannot be confirmed against another patient, even without the file');
select is((select status::text from public.result_imports where document_id = 'f0000000-0000-4000-8000-000000000002'), 'matched', 'and it stays waiting');

-- Conversions -------------------------------------------------------------------------------------------

select is(t.val(t.priya(), 'select count(*) > 0 from public.marker_conversions'), 'true', 'staff can read the conversions');
select throws_ok($$ select t.val(t.priya(), $q$ with x as (insert into public.marker_conversions (marker_id, from_unit, factor) values (t.m('TSH'), 'uIU/mL', 1) returning 1) select count(*) from x $q$) $$, '42501', null, 'a PA cannot add a conversion');
select lives_ok($$ select t.val(t.admin(), $q$ with x as (insert into public.marker_conversions (marker_id, from_unit, factor) values (t.m('TSH'), 'uIU/mL', 1) returning 1) select count(*) from x $q$) $$, 'an admin can');

select ok(not has_function_privilege('anon', 'public.enter_report(uuid, date, jsonb, text, uuid, uuid)', 'execute'), 'signed-out people cannot enter results');
select ok(not has_function_privilege('anon', 'public.release_report(uuid, text, text, text)', 'execute'), 'or release them');
select ok(not has_function_privilege('anon', 'public.register_import(uuid)', 'execute'), 'or register a file');

select * from finish();
rollback;
