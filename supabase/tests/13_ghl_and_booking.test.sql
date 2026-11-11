-- GoHighLevel contact link and patient booking (decided 11 to 12 November 2026).
-- Ids from supabase/seed.sql: Eleanor (patient) a..11 / d..01, Gina (doctor) a..01 / b..01, Priya (PA) a..03.
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

-- GoHighLevel contact link ------------------------------------------------------------------------

set local role service_role;
select lives_ok($$ select public.set_patient_ghl_contact('d0000000-0000-4000-8000-000000000001', 'ghl-contact-123') $$, 'the server records a patient''s GoHighLevel contact');
reset role;
select is((select ghl_contact_id from public.patient_profiles where id = 'd0000000-0000-4000-8000-000000000001'), 'ghl-contact-123', 'and it is stored');
select is((select metadata ->> 'system' from public.audit_log where entity = 'patient_profiles' order by id desc limit 1), 'ghl-sync', 'logged as the ghl-sync job');
select throws_ok($$ select t.run('a0000000-0000-4000-8000-000000000003', $q$select public.set_patient_ghl_contact('d0000000-0000-4000-8000-000000000001', 'x')$q$) $$, '42501', null, 'a PA cannot set it');

-- BOOKING

select * from finish();
rollback;
