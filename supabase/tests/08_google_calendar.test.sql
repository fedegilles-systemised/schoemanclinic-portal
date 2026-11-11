-- Google Calendar connections: each staff member reads only their own, nobody signed in
-- reads the token, and only the service role can save or remove one.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Gina (doctor), Tom (PA), Eleanor (patient): ids from supabase/seed.sql.
create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- The server saves Gina's connection.
set local role service_role;
select lives_ok(
  $$ select public.save_google_calendar_connection('a0000000-0000-4000-8000-000000000001', 'Gina@Example.test', 'v1.encrypted', 'openid email https://www.googleapis.com/auth/calendar.events') $$,
  'the service role saves a staff member''s connection');
select throws_ok(
  $$ select public.save_google_calendar_connection('a0000000-0000-4000-8000-000000000011', 'eleanor@example.test', 'v1.encrypted', 'openid') $$,
  '42501', null, 'a patient cannot be connected');
reset role;

select is(
  (select google_email from public.google_calendar_connections where user_id = 'a0000000-0000-4000-8000-000000000001'),
  'gina@example.test', 'the Google address is stored in lower case');
select is(
  (select actor_id from public.audit_log where entity = 'google_calendar_connections' order by id desc limit 1),
  'a0000000-0000-4000-8000-000000000001'::uuid, 'the change is logged under Gina');

-- Gina sees that she is connected, but never the token.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.google_calendar_connections), 1, 'a staff member reads her own connection');
select throws_ok($$ select refresh_token_encrypted from public.google_calendar_connections $$, '42501', null, 'nobody signed in reads the token');
select throws_ok($$ select scope from public.google_calendar_connections $$, '42501', null, 'or the granted scope');
select throws_ok(
  $$ insert into public.google_calendar_connections (user_id, google_email, refresh_token_encrypted, scope) values ('a0000000-0000-4000-8000-000000000001', 'x@example.test', 'x', 'x') $$,
  '42501', null, 'a staff member cannot write a connection directly');
select throws_ok($$ delete from public.google_calendar_connections $$, '42501', null, 'or delete one directly');
select throws_ok(
  $$ select public.save_google_calendar_connection('a0000000-0000-4000-8000-000000000001', 'x@example.test', 'x', 'x') $$,
  '42501', null, 'or call the save function');
reset role;

-- Nor change, remove or reach the private functions.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ update public.google_calendar_connections set google_email = 'x@example.test' $$, '42501', null, 'a staff member cannot update a connection directly');
select throws_ok($$ select public.remove_google_calendar_connection('a0000000-0000-4000-8000-000000000001') $$, '42501', null, 'or call the remove function');
select throws_ok($$ select private.save_google_calendar_connection('a0000000-0000-4000-8000-000000000001', 'x@example.test', 'x', 'x') $$, '42501', null, 'or the private save function');
reset role;

-- Signed-out visitors get nothing.
set local role anon;
select throws_ok($$ select user_id from public.google_calendar_connections $$, '42501', null, 'anon cannot read connections');
reset role;

-- Someone whose staff profile is switched off sees nothing, and cannot be connected again.
update public.staff_profiles set active = false where user_id = 'a0000000-0000-4000-8000-000000000001';
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.google_calendar_connections), 0, 'an inactive staff member does not read her connection');
reset role;
set local role service_role;
select throws_ok(
  $$ select public.save_google_calendar_connection('a0000000-0000-4000-8000-000000000001', 'gina@example.test', 'v1.encrypted', 'openid') $$,
  '42501', null, 'an inactive staff member cannot be connected');
reset role;
update public.staff_profiles set active = true where user_id = 'a0000000-0000-4000-8000-000000000001';

-- Other people see nothing.
select pg_temp.become('a0000000-0000-4000-8000-000000000004');
select is((select count(*)::int from public.google_calendar_connections), 0, 'a PA does not see a doctor''s connection');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.google_calendar_connections), 0, 'a patient sees no connection');
reset role;

-- Disconnecting removes the token.
set local role service_role;
select lives_ok($$ select public.remove_google_calendar_connection('a0000000-0000-4000-8000-000000000001') $$, 'the service role removes a connection');
reset role;
select is((select count(*)::int from public.google_calendar_connections), 0, 'and nothing is left');
select is(
  (select action from public.audit_log where entity = 'google_calendar_connections' order by id desc limit 1),
  'deleted', 'the removal is logged');

select * from finish();
rollback;
