-- With the whole team able to open every record (27 November 2026), the care team must not become
-- self-service: the rules the clinic kept on purpose (SignatureRx, inviting, red feedback alerts,
-- booking) follow the care team. A doctor changes a care team only when already on it; PAs and admins
-- change any. Fixed ids come from supabase/seed.sql. Everything is rolled back.
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

create function t.try(_user uuid, _sql text) returns text language plpgsql as $$
declare message text;
begin
  perform t.become(_user);
  begin
    execute _sql;
    message := 'ok';
  exception when others then
    message := sqlstate;
  end;
  reset role;
  return message;
end;
$$;

grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

create function t.laura() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000002'::uuid $$;
create function t.gina() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000001'::uuid $$;
create function t.pa() returns uuid language sql immutable as $$ select 'a0000000-0000-4000-8000-000000000004'::uuid $$;
create function t.s_laura() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000002'::uuid $$;
create function t.s_coach() returns uuid language sql immutable as $$ select 'b0000000-0000-4000-8000-000000000005'::uuid $$;
-- Eleanor is Gina's patient. Dr Laura Bennett is not on her care team.
create function t.p_eleanor() returns uuid language sql immutable as $$ select 'd0000000-0000-4000-8000-000000000001'::uuid $$;

select is(
  t.try(t.laura(), format($q$insert into public.care_team (patient_id, staff_id, relationship) values (%L, %L, 'doctor')$q$, t.p_eleanor(), t.s_laura())),
  '42501',
  'a doctor cannot add herself to the care team of a patient she does not look after'
);
select is(
  t.try(t.gina(), format($q$insert into public.care_team (patient_id, staff_id, relationship) values (%L, %L, 'doctor')$q$, t.p_eleanor(), t.s_laura())),
  'ok',
  'a doctor already on the care team can add a colleague'
);
select is(
  (select count(*)::int from public.care_team where patient_id = t.p_eleanor() and staff_id = t.s_laura()),
  1,
  'and the colleague is now on it'
);
select is(
  t.try(t.pa(), format($q$insert into public.care_team (patient_id, staff_id, relationship) values (%L, %L, 'health_coach')$q$, t.p_eleanor(), t.s_coach())),
  'ok',
  'a PA adds to any care team'
);

select * from finish();
rollback;
