-- Clinical notes: written by doctors, nurses and health coaches for their own patients, locked once
-- signed and final (nobody corrects a signed note), never deleted, and never shown to patients.
-- Ids from supabase/seed.sql: Gina (doctor) a..01 / b..01, on the care team of Eleanor d..01.
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

create function t.gina() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.laura() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000002'::uuid $$;
create function t.priya() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000003'::uuid $$;
create function t.admin() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000006'::uuid $$;
create function t.eleanor() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000011'::uuid $$;
create function t.s_gina() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.s_priya() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000003'::uuid $$;
create function t.p_eleanor() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-000000000001'::uuid $$;

-- Writing a draft -----------------------------------------------------------------------------

select is(
  t.run(t.gina(), format($q$insert into public.clinical_notes (patient_id, author_id, title, body) values (%L, %L, 'Follow-up', 'Feeling better.')$q$, t.p_eleanor(), t.s_gina())),
  1, 'a doctor writes a draft for her patient');
select throws_ok(
  format($$ select t.run(t.laura(), $q$insert into public.clinical_notes (patient_id, author_id, title, body) values (%L, 'b0000000-0000-4000-8000-000000000002', 'X', 'Y')$q$) $$, t.p_eleanor()),
  '42501', null, 'a doctor cannot write for a patient she does not look after');
select throws_ok(
  format($$ select t.run(t.priya(), $q$insert into public.clinical_notes (patient_id, author_id, title, body) values (%L, %L, 'X', 'Y')$q$) $$, t.p_eleanor(), t.s_priya()),
  '42501', null, 'a PA cannot write a note');
select throws_ok(
  format($$ select t.run(t.gina(), $q$insert into public.clinical_notes (patient_id, author_id, title, body) values (%L, %L, 'X', 'Y')$q$) $$, t.p_eleanor(), t.s_priya()),
  '42501', null, 'nobody writes in someone else''s name');

create temporary table note on commit drop as select id from public.clinical_notes where title = 'Follow-up';
grant select on note to authenticated, service_role;

select is(
  t.run(t.gina(), format($q$update public.clinical_notes set body = 'Feeling much better.' where id = %L$q$, (select id from note))),
  1, 'the author edits her draft');
select is(
  t.run(t.priya(), format($q$update public.clinical_notes set body = 'Changed' where id = %L$q$, (select id from note))),
  0, 'nobody else edits it');

-- Who reads notes ------------------------------------------------------------------------------

select is(t.n(t.priya(), 'select * from public.clinical_notes'), 1, 'a PA reads notes');
select is(t.n(t.admin(), 'select * from public.clinical_notes'), 1, 'an admin reads notes');
select is(t.n(t.laura(), 'select * from public.clinical_notes'), 0, 'a doctor not on the care team does not');
select is(t.n(t.eleanor(), 'select * from public.clinical_notes'), 0, 'the patient does not see notes');

-- Signing locks the note -------------------------------------------------------------------------

select throws_ok(
  format($$ select t.run(t.priya(), $q$select public.sign_clinical_note(%L)$q$) $$, (select id from note)),
  '42501', null, 'only the author signs');
select lives_ok(format($$ select t.run(t.gina(), $q$select public.sign_clinical_note(%L)$q$) $$, (select id from note)), 'the author signs');
select is((select status::text from public.clinical_notes where id = (select id from note)), 'signed', 'and the note is signed');
select is(
  t.run(t.gina(), format($q$update public.clinical_notes set body = 'Rewritten' where id = %L$q$, (select id from note))),
  0, 'a signed note cannot be edited through the app');
select throws_ok(
  format($$ update public.clinical_notes set body = 'Rewritten' where id = %L $$, (select id from note)),
  '42501', null, 'or by anyone at all');
select throws_ok(
  format($$ delete from public.clinical_notes where id = %L $$, (select id from note)),
  '42501', null, 'and no note is ever deleted');

-- A signed note is final: nobody corrects it (decided 12 November) ---------------------------------

select throws_ok(
  format($$ select t.run(t.gina(), $q$insert into public.clinical_notes (patient_id, author_id, title, body, supersedes_id) values (%L, %L, 'Follow-up', 'Corrected.', %L)$q$) $$, t.p_eleanor(), t.s_gina(), (select id from note)),
  '42501', null, 'not even its author can correct a signed note');
create temporary table correction_sql on commit drop as
  select format($$ insert into public.clinical_notes (patient_id, author_id, title, body, supersedes_id) values (%L, %L, 'Follow-up', 'Corrected.', %L) $$, t.p_eleanor(), t.s_gina(), (select id from note)) as q;
grant select on correction_sql to service_role;
set local role service_role;
select throws_ok(
  (select q from correction_sql),
  '42501', null, 'nor can the server');
reset role;
select is((select body from public.clinical_notes where id = (select id from note)), 'Feeling much better.', 'and the signed note is unchanged');

select cmp_ok((select count(*)::int from public.audit_log where entity = 'clinical_notes'), '>=', 3, 'every change is in the audit log');

select throws_ok(
  format($$ select t.run(t.gina(), $q$insert into public.clinical_notes (patient_id, author_id, title, body, source) values (%L, %L, 'X', 'Y', 'recording')$q$) $$, t.p_eleanor(), t.s_gina()),
  '42501', null, 'only the server marks a note as coming from a recording');

select * from finish();
rollback;
