-- The role matrix. Each helper runs SQL as a role, the way PostgREST does, then returns to
-- postgres so pgTAP keeps working. Fixed ids come from supabase/seed.sql.
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

create function t.as_service(_sql text) returns void language plpgsql as $$
begin
  set local role service_role;
  execute _sql;
  reset role;
end;
$$;

grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

create function t.gina() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.laura() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000002'::uuid $$;
create function t.priya() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000003'::uuid $$;
create function t.coach() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000005'::uuid $$;
create function t.admin() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000006'::uuid $$;
create function t.eleanor() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000011'::uuid $$;
create function t.thomas() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000012'::uuid $$;
create function t.mark() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000021'::uuid $$;
create function t.ruth() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000022'::uuid $$;

-- Patient ids
-- Eleanor d...001, Thomas d...002, Sophie d...006, Isla d...00a
-- Reports: Eleanor released ...003, Eleanor unreleased ...004

-- anon --------------------------------------------------------------------------

select throws_ok($$ select t.n(null, 'select * from public.profiles') $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select t.n(null, 'select * from public.patient_profiles') $$, '42501', null, 'anon cannot read patient profiles');
select throws_ok($$ select t.n(null, 'select * from public.results') $$, '42501', null, 'anon cannot read results');
select throws_ok($$ select t.n(null, 'select * from public.markers') $$, '42501', null, 'anon cannot read reference data');
select throws_ok($$ select t.n(null, 'select * from public.get_staff_directory()') $$, '42501', null, 'anon cannot call get_staff_directory');
select throws_ok($$ select t.n(null, 'select * from public.get_my_patient_record()') $$, '42501', null, 'anon cannot call get_my_patient_record');
select throws_ok($$ select t.n(null, 'select private.has_role(''admin'')') $$, '42501', null, 'anon cannot call private helpers');

-- patient ---------------------------------------------------------------------------

select is(t.n(t.eleanor(), 'select * from public.appointments'), 1, 'a patient reads only their own appointment');
select is(t.n(t.eleanor(), $q$select * from public.appointments where patient_id = 'd0000000-0000-4000-8000-000000000002'$q$), 0, 'a patient cannot read another patient''s appointment');
select is(t.n(t.eleanor(), 'select * from public.medications'), 3, 'a patient reads their own medications');
select is(t.n(t.eleanor(), 'select * from public.patient_profiles'), 0, 'a patient has no direct read of patient_profiles');
select is(t.n(t.eleanor(), 'select * from public.staff_profiles'), 0, 'a patient has no direct read of staff_profiles');
select is(t.n(t.eleanor(), 'select * from public.get_my_patient_record()'), 1, 'get_my_patient_record returns the patient''s own row');
select is(t.n(t.eleanor(), 'select * from public.get_staff_directory()'), 7, 'get_staff_directory returns the active team');
select hasnt_function('public', 'staff_directory', 'no staff_directory function');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.proname in ('get_my_patient_record', 'get_staff_directory')
     and pg_get_function_result(p.oid) ~ '(ghl_|semble_|stripe_|gmc_number|signature_path)'),
  0, 'read functions return no hidden columns');

select is(t.n(t.eleanor(), 'select * from public.lab_reports'), 3, 'a patient reads released reports only');
select is(t.n(t.eleanor(), $q$select * from public.lab_reports where id = '14000000-0000-4000-8000-000000000004'$q$), 0, 'a patient cannot read an unreleased report');
select is(t.n(t.eleanor(), $q$select * from public.results where lab_report_id = '14000000-0000-4000-8000-000000000004'$q$), 0, 'a patient cannot read results from an unreleased report');
select is(t.n(t.eleanor(), 'select * from public.results'), 30, 'a patient reads their released results');
select is(t.n(t.eleanor(), $q$select * from public.documents where id = '13000000-0000-4000-8000-000000000005'$q$), 0, 'a shared lab PDF stays hidden until its report is released');
select is(t.n(t.eleanor(), $q$select * from public.documents where id = '13000000-0000-4000-8000-000000000004'$q$), 1, 'a released lab PDF is visible');
select is(t.n(t.eleanor(), $q$select * from public.documents where id = '13000000-0000-4000-8000-000000000003'$q$), 0, 'an unshared document is hidden');
select is(t.n(t.eleanor(), 'select * from public.safeguarding_alerts'), 0, 'a patient cannot read safeguarding alerts');
select is(t.n(t.eleanor(), 'select * from public.result_imports'), 0, 'a patient cannot read the import queue');
select is(t.n(t.eleanor(), 'select * from public.care_team'), 0, 'a patient cannot read the care team');
select throws_ok($$ select t.n(t.eleanor(), 'select * from public.audit_log') $$, '42501', null, 'a patient cannot read audit_log');
select throws_ok($$ select t.n(t.eleanor(), 'select * from public.webhook_events') $$, '42501', null, 'a patient cannot read webhook_events');

select throws_ok($$ select t.run(t.eleanor(), $q$insert into public.user_roles (user_id, role) values ('a0000000-0000-4000-8000-000000000011', 'admin')$q$) $$, '42501', null, 'a patient cannot grant themselves a role');
select throws_ok($$ select t.run(t.eleanor(), $q$update public.user_roles set role = 'admin' where user_id = 'a0000000-0000-4000-8000-000000000011'$q$) $$, '42501', null, 'a patient cannot change their role');
select throws_ok($$ select t.run(t.eleanor(), $q$delete from public.user_roles where user_id = 'a0000000-0000-4000-8000-000000000011'$q$) $$, '42501', null, 'a patient cannot remove a role');
select throws_ok($$ select t.run(t.eleanor(), $q$update public.profiles set status = 'suspended' where id = 'a0000000-0000-4000-8000-000000000011'$q$) $$, '42501', null, 'a patient cannot change their status');
select throws_ok($$ select t.run(t.eleanor(), $q$update public.patient_profiles set stripe_customer_id = 'x' where id = 'd0000000-0000-4000-8000-000000000001'$q$) $$, '42501', null, 'a patient cannot change external ids');
select throws_ok($$ select t.run(t.eleanor(), $q$update public.patient_profiles set user_id = null where id = 'd0000000-0000-4000-8000-000000000001'$q$) $$, '42501', null, 'a patient cannot change user_id');
select is(t.run(t.eleanor(), $q$update public.patient_profiles set first_name = 'X' where id = 'd0000000-0000-4000-8000-000000000001'$q$), 0, 'a patient cannot edit their patient profile directly');
select is(t.run(t.eleanor(), $q$update public.profiles set phone = '07700 900000' where id = 'a0000000-0000-4000-8000-000000000011'$q$), 1, 'a patient can edit their own phone');
select is(t.run(t.eleanor(), $q$update public.profiles set phone = '07700 900000' where id = 'a0000000-0000-4000-8000-000000000012'$q$), 0, 'a patient cannot edit someone else''s profile');
select is(t.n(t.eleanor(), 'select * from public.profiles'), 1, 'a patient reads only their own profile');
select is(t.n(t.eleanor(), 'select * from public.notifications'), 2, 'a patient reads only their own notifications');
select throws_ok($$ select t.run(t.eleanor(), $q$update public.notifications set title = 'x'$q$) $$, '42501', null, 'a patient cannot rewrite a notification');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into public.lab_reports (patient_id) values ('d0000000-0000-4000-8000-000000000001')$q$) $$, '42501', null, 'a patient cannot write a report');
select throws_ok($$ select t.run(t.eleanor(), $q$update public.lab_reports set released_at = now(), status = 'released'$q$) $$, '42501', null, 'a patient cannot release a report');
select lives_ok($$ select t.run(t.eleanor(), $q$insert into public.questions (patient_id, asked_by, subject, body) values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Test', 'Test')$q$) $$, 'a patient can ask a question');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into public.questions (patient_id, asked_by, subject, body) values ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000011', 'Test', 'Test')$q$) $$, '42501', null, 'a patient cannot ask a question for another patient');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into public.questions (patient_id, asked_by, subject, body, status) values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'Test', 'Test', 'closed')$q$) $$, '42501', null, 'a patient cannot set a question''s status');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into public.documents (patient_id, kind, title, storage_path, uploaded_by, shared_with_patient) values ('d0000000-0000-4000-8000-000000000001', 'letter', 'Fake', 'd0000000-0000-4000-8000-000000000001/fake.pdf', 'a0000000-0000-4000-8000-000000000011', true)$q$) $$, '42501', null, 'a patient can only upload the patient_upload kind');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into public.documents (patient_id, kind, title, storage_path, source, uploaded_by, shared_with_patient) values ('d0000000-0000-4000-8000-000000000001', 'patient_upload', 'Lab result from TDL', 'd0000000-0000-4000-8000-000000000001/claim.pdf', 'tdl', 'a0000000-0000-4000-8000-000000000011', true)$q$) $$, '42501', null, 'a patient upload cannot claim to come from a lab');
insert into storage.objects (bucket_id, name) values ('documents', 'd0000000-0000-4000-8000-000000000001/orphan.pdf');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into public.documents (patient_id, kind, title, storage_path, source, uploaded_by, shared_with_patient) values ('d0000000-0000-4000-8000-000000000001', 'patient_upload', 'Mine now', 'd0000000-0000-4000-8000-000000000001/orphan.pdf', 'patient_upload', 'a0000000-0000-4000-8000-000000000011', true)$q$) $$, '42501', null, 'a patient cannot claim a file someone else put in their folder');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into public.documents (patient_id, kind, title, storage_path, source, uploaded_by, shared_with_patient) values ('d0000000-0000-4000-8000-000000000001', 'patient_upload', 'Row first', 'd0000000-0000-4000-8000-000000000001/not-there-yet.pdf', 'patient_upload', 'a0000000-0000-4000-8000-000000000011', true)$q$) $$, '42501', null, 'a patient cannot create a row before their file exists');
insert into storage.objects (bucket_id, name, owner_id) values ('documents', 'd0000000-0000-4000-8000-000000000001/my-upload.pdf', t.eleanor()::text);
select lives_ok($$ select t.run(t.eleanor(), $q$insert into public.documents (patient_id, kind, title, storage_path, source, uploaded_by, shared_with_patient) values ('d0000000-0000-4000-8000-000000000001', 'patient_upload', 'My upload', 'd0000000-0000-4000-8000-000000000001/my-upload.pdf', 'patient_upload', 'a0000000-0000-4000-8000-000000000011', true)$q$) $$, 'a patient can register a file they uploaded');
select throws_ok($$ select t.run(t.thomas(), $q$delete from public.questions$q$) $$, '42501', null, 'nobody signed in can delete a clinical row');

-- guardian ---------------------------------------------------------------------------

select is(t.n(t.mark(), 'select * from public.get_my_patient_record() where not is_self and can_act'), 1, 'a guardian with can_act sees the ward with can_act');
select is(t.n(t.mark(), 'select * from public.appointments'), 1, 'a guardian reads the ward''s appointments');
select is(t.n(t.mark(), $q$select * from public.appointments where patient_id = 'd0000000-0000-4000-8000-000000000001'$q$), 0, 'a guardian cannot read an unrelated patient');
select is(t.n(t.mark(), 'select * from public.results'), 2, 'a guardian reads the ward''s released results');
select lives_ok($$ select t.run(t.mark(), $q$insert into public.questions (patient_id, asked_by, subject, body) values ('d0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000021', 'Test', 'Test')$q$) $$, 'a guardian with can_act can ask a question');
select is(t.n(t.ruth(), 'select * from public.get_my_patient_record() where not can_act'), 1, 'a guardian without can_act sees the ward without can_act');
select is(t.n(t.ruth(), 'select * from public.appointments'), 2, 'a guardian without can_act can still read');
select throws_ok($$ select t.run(t.ruth(), $q$insert into public.questions (patient_id, asked_by, subject, body) values ('d0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000022', 'Test', 'Test')$q$) $$, '42501', null, 'a guardian without can_act cannot ask a question');
select throws_ok($$ select t.run(t.ruth(), $q$insert into public.repeat_requests (medication_id, patient_id, requested_by) values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000022')$q$) $$, '42501', null, 'a guardian without can_act cannot request a repeat');
select throws_ok($$ select t.run(t.ruth(), $q$insert into public.consents (patient_id, consent_type, version, granted) values ('d0000000-0000-4000-8000-000000000006', 'research', '1', true)$q$) $$, '42501', null, 'a guardian without can_act cannot change a consent');
select is(t.n(t.ruth(), 'select * from public.safeguarding_alerts'), 0, 'a guardian cannot read safeguarding alerts');

-- An unverified guardian link gives nothing.
update public.patient_guardians set verified_by = null where guardian_user_id = t.mark();
select is(t.n(t.mark(), 'select * from public.appointments'), 0, 'an unverified guardian reads nothing');
select is(t.n(t.mark(), 'select * from public.get_my_patient_record()'), 0, 'an unverified guardian has no patient record');
update public.patient_guardians set verified_by = 'b0000000-0000-4000-8000-000000000003' where guardian_user_id = t.mark();

-- PA ---------------------------------------------------------------------------------

select is(t.n(t.priya(), 'select * from public.patient_profiles'), 11, 'a PA reads patient profiles');
select is(t.n(t.priya(), $q$select * from public.lab_reports where id = '14000000-0000-4000-8000-000000000004'$q$), 1, 'a PA reads an unreleased report');
select is(t.n(t.priya(), 'select * from public.safeguarding_alerts'), 0, 'a PA cannot read safeguarding alerts');
select is(t.n(t.priya(), 'select * from public.result_imports'), 3, 'a PA reads the import queue');
select is(t.n(t.priya(), $q$select * from public.documents where id = '13000000-0000-4000-8000-000000000012'$q$), 1, 'a PA reads an unmatched document');
select throws_ok($$ select t.run(t.priya(), $q$insert into public.invitations (email, role, invited_by, token_hash, expires_at) values ('x@example.test', 'patient', 'b0000000-0000-4000-8000-000000000003', 'h', now())$q$) $$, '42501', null, 'invitations are created by server code, not the client');
select throws_ok($$ select t.run(t.admin(), $q$insert into public.invitations (email, role, invited_by, token_hash, expires_at) values ('x@example.test', 'doctor', 'b0000000-0000-4000-8000-000000000006', 'h', now())$q$) $$, '42501', null, 'not even an admin can choose an invitation token');
select throws_ok($$ insert into public.invitations (email, kind, role, patient_id, invited_by, token_hash, expires_at) values ('z@example.test', 'patient', 'patient', 'd0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003', 'too-short', now()) $$, '23514', null, 'an invitation token hash must be long enough');
select throws_ok($$ insert into public.invitations (email, kind, role, patient_id, invited_by, token_hash, expires_at) values ('z@example.test', 'patient', 'patient', 'd0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003', repeat('a', 64), '9999-01-01') $$, '23514', null, 'an invitation cannot last for years');

-- The release gate on files cannot be opened by relabelling.
select throws_ok($$ select t.run(t.priya(), $q$update public.documents set kind = 'letter' where id = '13000000-0000-4000-8000-000000000005'$q$) $$, '42501', null, 'a PA cannot relabel a lab PDF');
update public.documents set kind = 'other' where id = '13000000-0000-4000-8000-000000000005';
select is(t.n(t.eleanor(), $q$select * from public.documents where id = '13000000-0000-4000-8000-000000000005'$q$), 0, 'a relabelled PDF stays hidden while its report is unreleased');
select is(t.n(t.coach(), $q$select * from public.documents where id = '13000000-0000-4000-8000-000000000005'$q$), 0, 'and from the health coach');
update public.documents set kind = 'lab_report' where id = '13000000-0000-4000-8000-000000000005';

-- Guardian links cannot be forged.
select throws_ok($$ select t.run(t.priya(), $q$insert into public.patient_guardians (patient_id, guardian_user_id, relationship, verified_by) values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'carer', 'b0000000-0000-4000-8000-000000000001')$q$) $$, '42501', null, 'a PA cannot verify a link in a doctor''s name');
select throws_ok($$ select t.run(t.priya(), $q$insert into public.patient_guardians (patient_id, guardian_user_id, relationship, verified_by) values ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'carer', 'b0000000-0000-4000-8000-000000000003')$q$) $$, '42501', null, 'a PA cannot link themselves to a patient');
select throws_ok($$ select t.run(t.priya(), $q$update public.patient_guardians set verified_by = 'b0000000-0000-4000-8000-000000000001' where guardian_user_id = 'a0000000-0000-4000-8000-000000000021'$q$) $$, '42501', null, 'a PA cannot rewrite who verified a link');
select lives_ok($$ select t.run(t.priya(), $q$insert into public.patient_guardians (patient_id, guardian_user_id, relationship, verified_by) values ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000022', 'carer', 'b0000000-0000-4000-8000-000000000003')$q$) $$, 'a PA can verify a link in their own name');

-- Attribution and imports.
select throws_ok($$ select t.run(t.priya(), $q$update public.result_imports set handled_by = 'b0000000-0000-4000-8000-000000000001' where id = '15000000-0000-4000-8000-000000000002'$q$) $$, '42501', null, 'a PA cannot attribute an import to a doctor');
select throws_ok($$ select t.run(t.priya(), $q$update public.result_imports set patient_id = 'd0000000-0000-4000-8000-000000000001' where id = '15000000-0000-4000-8000-000000000001'$q$) $$, '42501', null, 'an import cannot be matched to a patient other than its document''s');
update public.result_imports set status = 'confirmed' where id = '15000000-0000-4000-8000-000000000003';
select is(t.run(t.priya(), $q$update public.result_imports set status = 'matched' where id = '15000000-0000-4000-8000-000000000003'$q$), 0, 'a confirmed import cannot be reopened');
update public.result_imports set status = 'matched' where id = '15000000-0000-4000-8000-000000000003';
select throws_ok($$ update public.lab_reports set document_id = '13000000-0000-4000-8000-000000000011' where id = '14000000-0000-4000-8000-000000000003' $$, '23503', null, 'a report cannot point at another patient''s document');

-- Offboarding takes effect straight away.
update public.staff_profiles set active = false where user_id = t.priya();
select is(t.n(t.priya(), 'select * from public.patient_profiles'), 0, 'a deactivated PA reads no patients');
update public.staff_profiles set active = true, archived_at = now() where user_id = t.priya();
select is(t.n(t.priya(), 'select * from public.results'), 0, 'an archived PA reads no results');
update public.staff_profiles set archived_at = null where user_id = t.priya();
select throws_ok($$ select t.n(t.priya(), 'select token_hash from public.invitations') $$, '42501', null, 'nobody signed in reads an invitation token hash');
select throws_ok($$ select t.run(t.priya(), $q$update public.lab_orders set status = 'paid' where order_ref = 'LO-2026-014'$q$) $$, '42501', null, 'a PA cannot mark an order as paid');
select throws_ok($$ select t.run(t.priya(), $q$update public.lab_orders set barcode = 'x' where order_ref = 'LO-2026-014'$q$) $$, '42501', null, 'a PA cannot set a barcode');
select throws_ok($$ select t.run(t.priya(), $q$update public.result_imports set status = 'confirmed'$q$) $$, '42501', null, 'a PA cannot confirm an import directly');
select throws_ok($$ select t.run(t.priya(), $q$update public.results set value_numeric = 1$q$) $$, '42501', null, 'a PA cannot change a result value');
select is(t.run(t.priya(), $q$update public.results set doctor_comment = 'x'$q$), 0, 'a PA cannot comment on a result');
select throws_ok($$ select t.n(t.priya(), 'select * from public.audit_log') $$, '42501', null, 'a PA cannot read audit_log');

-- doctor -----------------------------------------------------------------------------

-- Since 11 November a doctor sees only the patients on her care team (09_care_team_access covers the rest).
select is(t.n(t.gina(), 'select * from public.safeguarding_alerts'), 2, 'a doctor reads safeguarding alerts for her care-team patients only');
select is(t.n(t.gina(), 'select * from public.lab_reports where released_at is null'), 6, 'a doctor reads unreleased reports');
select throws_ok($$ select t.run(t.gina(), $q$insert into public.medications (patient_id, name, kind, prescriber_id, start_date, supply_days) values ('d0000000-0000-4000-8000-000000000001', 'X', 'supplement', 'b0000000-0000-4000-8000-000000000002', current_date, 1)$q$) $$, '42501', null, 'a doctor cannot prescribe in a colleague''s name');
select throws_ok($$ select t.run(t.gina(), $q$update public.staff_profiles set signature_path = 'a0000000-0000-4000-8000-000000000002/x.png' where user_id = 'a0000000-0000-4000-8000-000000000001'$q$) $$, '23514', null, 'a signature path must be the person''s own');
select is(t.run(t.gina(), $q$update public.results set doctor_comment = 'Reviewed.' where lab_report_id = '14000000-0000-4000-8000-000000000011'$q$), 4, 'a doctor can comment on results');
select throws_ok($$ select t.run(t.gina(), $q$update public.results set flag = 'normal'$q$) $$, '42501', null, 'a doctor cannot rewrite a result flag');
select throws_ok($$ select t.run(t.gina(), $q$update public.lab_reports set released_at = now(), status = 'released'$q$) $$, '42501', null, 'release goes through server code, not the client');
select throws_ok($$ select t.run(t.gina(), $q$insert into public.user_roles (user_id, role) values ('a0000000-0000-4000-8000-000000000001', 'admin')$q$) $$, '42501', null, 'a doctor cannot grant a role');
select throws_ok($$ select t.run(t.gina(), $q$delete from public.safeguarding_alerts$q$) $$, '42501', null, 'a doctor cannot delete a safeguarding alert');
select is(t.run(t.gina(), $q$update public.profiles set status = 'suspended' where id = 'a0000000-0000-4000-8000-000000000011'$q$), 0, 'a doctor cannot change someone else''s account status');
select throws_ok($$ select t.run(t.gina(), $q$update public.profiles set status = 'suspended' where id = 'a0000000-0000-4000-8000-000000000001'$q$) $$, '42501', null, 'a doctor cannot change their own account status');

-- A doctor who is also a patient.
select is(t.n(t.laura(), 'select * from public.get_my_patient_record() where is_self'), 1, 'a doctor who is a patient has a patient record');
select is(t.n(t.laura(), 'select * from public.safeguarding_alerts'), 1, 'and keeps doctor access to her own care-team patient');

-- health coach -----------------------------------------------------------------------

select is(t.n(t.coach(), 'select * from public.safeguarding_alerts'), 0, 'a health coach cannot read safeguarding alerts');
-- The seeded coach is on no care team, so sees no patient's data at all.
select is(t.n(t.coach(), 'select * from public.lab_reports where released_at is null'), 0, 'a health coach on no care team reads no unreleased report');
select is(t.n(t.coach(), $q$select * from public.results where lab_report_id = '14000000-0000-4000-8000-000000000004'$q$), 0, 'a health coach on no care team reads no unreleased result');
select is(t.n(t.coach(), 'select * from public.results'), 0, 'or any result');
select is(t.n(t.coach(), $q$select * from public.documents where id = '13000000-0000-4000-8000-000000000005'$q$), 0, 'a health coach reads no unreleased lab PDF');
select is(t.n(t.coach(), 'select * from public.result_imports'), 0, 'a health coach cannot read the import queue');
select is(t.n(t.coach(), 'select * from public.care_team'), 0, 'a health coach cannot read team-only tables');
select is(t.n(t.coach(), 'select * from public.staff_profiles'), 1, 'a health coach reads only their own staff profile');

-- admin ------------------------------------------------------------------------------

-- Decided 11 November: admins read every patient's clinical record.
select is(t.n(t.admin(), 'select * from public.patient_profiles'), (select count(*)::int from public.patient_profiles), 'an admin reads every patient profile');
select cmp_ok(t.n(t.admin(), 'select * from public.results'), '>', 0, 'and results');
select is(t.n(t.admin(), 'select * from public.safeguarding_alerts'), 0, 'an admin cannot read safeguarding alerts');
select cmp_ok(t.n(t.admin(), 'select * from public.user_roles'), '>', 1, 'an admin reads all roles');
select is(t.n(t.admin(), 'select * from public.staff_profiles'), 7, 'an admin reads staff profiles');
select throws_ok($$ select t.run(t.admin(), $q$insert into public.user_roles (user_id, role) values ('a0000000-0000-4000-8000-000000000006', 'doctor')$q$) $$, '42501', null, 'an admin cannot change their own role from the client');
select is(t.run(t.admin(), $q$update public.profiles set status = 'suspended' where id = 'a0000000-0000-4000-8000-000000000022'$q$), 1, 'an admin can suspend an account');
select throws_ok($$ select t.run(t.admin(), $q$update public.profiles set full_name = 'X' where id = 'a0000000-0000-4000-8000-000000000012'$q$) $$, '42501', null, 'an admin cannot rewrite someone else''s details');
select throws_ok($$ select t.n(t.admin(), 'select * from public.audit_log') $$, '42501', null, 'an admin has no client read of audit_log');

-- A suspended account fails every check.
select is(t.n(t.ruth(), 'select * from public.appointments'), 0, 'a suspended guardian reads nothing');
update public.profiles set status = 'suspended' where id = t.gina();
select is(t.n(t.gina(), 'select * from public.patient_profiles'), 0, 'a suspended doctor reads nothing');
update public.profiles set status = 'active' where id = t.gina();

-- An archived patient can no longer act.
update public.patient_profiles set archived_at = now() where id = 'd0000000-0000-4000-8000-000000000002';
select throws_ok($$ select t.run(t.thomas(), $q$insert into public.questions (patient_id, asked_by, subject, body) values ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000012', 'Test', 'Test')$q$) $$, '42501', null, 'an archived patient cannot act');
update public.patient_profiles set archived_at = null where id = 'd0000000-0000-4000-8000-000000000002';

-- Server code can still do its job.
select set_config('app.system_actor', 'role-matrix-test', true);
select lives_ok($$ select t.as_service($q$update public.staff_profiles set job_title = 'PA' where user_id = 'a0000000-0000-4000-8000-000000000004'$q$) $$, 'server code can update staff profiles');
select lives_ok($$ select t.as_service($q$update public.patient_profiles set stripe_customer_id = 'cus_x' where id = 'd0000000-0000-4000-8000-000000000001'$q$) $$, 'server code can write external ids');
select set_config('app.system_actor', '', true);
select set_config('app.actor_id', t.gina()::text, true);
select lives_ok($$ select t.as_service($q$update public.lab_reports set patient_comment = 'x' where id = '14000000-0000-4000-8000-000000000004'$q$) $$, 'server code can update a report');
select set_config('app.actor_id', '', true);
select is((select actor_id from public.audit_log where entity = 'lab_reports' and action = 'updated' order by id desc limit 1), t.gina(), 'and the audit log names the person it acted for');

-- auth --------------------------------------------------------------------------------

insert into auth.users (id, email, aud, role) values ('a0000000-0000-4000-8000-0000000000ff', 'new@example.test', 'authenticated', 'authenticated');
select is((select status::text from public.profiles where id = 'a0000000-0000-4000-8000-0000000000ff'), 'invited', 'a new auth user gets a profile, status invited');
select is((select count(*)::int from public.user_roles where user_id = 'a0000000-0000-4000-8000-0000000000ff'), 0, 'and no role');
select throws_ok($$ delete from auth.users where id = 'a0000000-0000-4000-8000-000000000011' $$, '23503', null, 'deleting an auth user with a profile fails');

-- deletes and audit --------------------------------------------------------------------

select throws_ok($$ delete from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001' $$, '23503', null, 'deleting a patient with records fails');
select throws_ok($$ select t.as_service($q$delete from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'$q$) $$, '42501', null, 'even the service role cannot delete a patient');

select cmp_ok((select count(*)::int from public.audit_log where entity = 'results'), '>', 0, 'seeding the results wrote to audit_log');
select is(
  (select metadata -> 'changed' from public.audit_log where entity = 'results' and action = 'updated' and actor_id = t.gina() order by id desc limit 1),
  '["doctor_comment"]'::jsonb,
  'an update records the actor and the changed column, not the value');
select is((select actor_role::text from public.audit_log where entity = 'results' and action = 'updated' and actor_id = t.gina() order by id desc limit 1), 'doctor', 'and the actor''s role');

select throws_ok($$ update public.audit_log set action = 'x' $$, '42501', null, 'postgres cannot update audit_log');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'postgres cannot delete audit_log');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'postgres cannot truncate audit_log');
select throws_ok($$ select t.as_service('update public.audit_log set action = ''x''') $$, '42501', null, 'the service role cannot update audit_log');
select throws_ok($$ select t.as_service('delete from public.audit_log') $$, '42501', null, 'the service role cannot delete audit_log');
select lives_ok($$ select t.as_service($q$insert into public.audit_log (action, entity) values ('viewed', 'patient_profiles')$q$) $$, 'server code can append to audit_log');

-- storage ------------------------------------------------------------------------------

insert into storage.objects (bucket_id, name) values
  ('documents', 'd0000000-0000-4000-8000-000000000001/lab-released.pdf'),
  ('documents', 'd0000000-0000-4000-8000-000000000001/lab-unreleased.pdf'),
  ('documents', 'd0000000-0000-4000-8000-000000000001/internal-note.pdf'),
  ('documents', 'd0000000-0000-4000-8000-000000000008/tdl-sch-1000139.pdf'),
  ('avatars', 'a0000000-0000-4000-8000-000000000001/photo.png'),
  ('avatars', 'a0000000-0000-4000-8000-000000000012/photo.png');

select is(t.n(t.eleanor(), $q$select * from storage.objects where bucket_id = 'documents' and name not like '%/my-upload.pdf'$q$), 1, 'a patient reads only the released file of their own');
select is(t.n(t.thomas(), $q$select * from storage.objects where bucket_id = 'documents'$q$), 0, 'another patient reads none of those files');
select is(t.n(t.gina(), $q$select * from storage.objects where bucket_id = 'documents' and name not like '%/my-upload.pdf'$q$), 4, 'a doctor reads the files');
select is(t.n(t.eleanor(), $q$select * from storage.objects where bucket_id = 'avatars'$q$), 1, 'a patient sees staff photos but not another patient''s');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into storage.objects (bucket_id, name) values ('documents', 'd0000000-0000-4000-8000-000000000002/x.pdf')$q$) $$, '42501', null, 'a patient cannot upload to another patient''s folder');
select lives_ok($$ select t.run(t.eleanor(), $q$insert into storage.objects (bucket_id, name) values ('documents', 'd0000000-0000-4000-8000-000000000001/mine.pdf')$q$) $$, 'a patient can upload to their own folder');
select throws_ok($$ select t.run(t.eleanor(), $q$insert into storage.objects (bucket_id, name) values ('avatars', 'a0000000-0000-4000-8000-000000000012/x.png')$q$) $$, '42501', null, 'a person cannot upload another person''s avatar');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'), 0, 'no policy lets anyone delete a file');

select * from finish();
rollback;
