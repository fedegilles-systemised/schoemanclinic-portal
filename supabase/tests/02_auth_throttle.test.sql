-- The sign-in and password reset attempt limits.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(not has_function_privilege('anon', 'public.auth_throttle_hit(text[], integer[], integer)', 'execute'), 'anon cannot call the throttle');
select ok(not has_function_privilege('authenticated', 'public.auth_throttle_hit(text[], integer[], integer)', 'execute'), 'authenticated cannot call the throttle');
select ok(not has_table_privilege('authenticated', 'private.auth_throttle', 'select'), 'authenticated cannot read the counters');
select ok(not has_table_privilege('service_role', 'private.auth_throttle', 'select'), 'the service role reaches the counters only through the function');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'auth_throttle'),
  0, 'the counters are not in the exposed schema');

set local role service_role;

select ok(public.auth_throttle_hit(array['a', 'b'], array[2, 5], 60), 'first attempt is allowed');
select ok(public.auth_throttle_hit(array['a', 'b'], array[2, 5], 60), 'second attempt is allowed');
select ok(not public.auth_throttle_hit(array['a', 'b'], array[2, 5], 60), 'a full bucket refuses the attempt');
select ok(public.auth_throttle_hit(array['b'], array[3], 60), 'a refused attempt did not count in the other bucket');
select ok(not public.auth_throttle_hit(array['b'], array[3], 60), 'the other bucket is now full at its own limit');
select ok(public.auth_throttle_hit(array['c'], array[1], 60), 'other keys are not affected');

reset role;

select is((select attempts from private.auth_throttle where key_hash = 'a'), 2, 'the attempt count is stored');

update private.auth_throttle set window_ends_at = now() - interval '1 second' where key_hash = 'a';
set local role service_role;
select ok(public.auth_throttle_hit(array['a'], array[2], 60), 'an expired window starts again');
reset role;
select is((select attempts from private.auth_throttle where key_hash = 'a'), 1, 'the count restarted');

select * from finish();
rollback;
