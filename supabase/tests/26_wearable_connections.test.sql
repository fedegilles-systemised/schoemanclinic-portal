-- Wearables linked directly: consent first, tokens never readable by signed-in people, readings written
-- once per day by the sync, and a link removed on disconnect or when consent is withdrawn.
-- Ids from supabase/seed.sql: Eleanor (patient) a..11 / d..01; Thomas a..12 / d..02; Priya (PA) a..03.
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

-- 1. Linking needs consent and the right person ---------------------------------------------------

select pg_temp.service();
select throws_ok($$ select public.save_wearable_connection('d0000000-0000-4000-8000-000000000001', 'oura', 'a0000000-0000-4000-8000-000000000011', 'enc-a', 'enc-r', now() + interval '1 day', 'daily') $$, '22023', null, 'a link needs the patient''s consent first');
reset role;

insert into public.consents (patient_id, consent_type, version, granted) values ('d0000000-0000-4000-8000-000000000001', 'wearables', '2026-11', true);

select pg_temp.service();
select throws_ok($$ select public.save_wearable_connection('d0000000-0000-4000-8000-000000000001', 'oura', 'a0000000-0000-4000-8000-000000000003', 'enc-a', 'enc-r', now() + interval '1 day', 'daily') $$, '42501', null, 'a PA cannot link a patient''s account');
select throws_ok($$ select public.save_wearable_connection('d0000000-0000-4000-8000-000000000001', 'oura', 'a0000000-0000-4000-8000-000000000012', 'enc-a', 'enc-r', now() + interval '1 day', 'daily') $$, '42501', null, 'nor another patient');
select lives_ok($$ select public.save_wearable_connection('d0000000-0000-4000-8000-000000000001', 'oura', 'a0000000-0000-4000-8000-000000000011', 'enc-a', 'enc-r', now() + interval '1 day', 'daily') $$, 'the patient links Oura');
select lives_ok($$ select public.save_wearable_connection('d0000000-0000-4000-8000-000000000001', 'oura', 'a0000000-0000-4000-8000-000000000011', 'enc-a2', 'enc-r2', now() + interval '2 days', 'daily') $$, 'linking again replaces the tokens');
select lives_ok($$ select public.save_wearable_connection('d0000000-0000-4000-8000-000000000001', 'whoop', 'a0000000-0000-4000-8000-000000000011', 'enc-a', 'enc-r', now() + interval '1 day', 'read:sleep') $$, 'and WHOOP is a separate link');
reset role;
select is((select count(*)::int from public.wearable_connections where patient_id = 'd0000000-0000-4000-8000-000000000001' and provider = 'oura'), 1, 'one link per provider');

-- 2. Who can read what ----------------------------------------------------------------------------

select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.wearable_connections), 2, 'the patient sees their own links');
select throws_ok($$ select access_token_encrypted from public.wearable_connections $$, '42501', null, 'but never the access token');
select throws_ok($$ select refresh_token_encrypted from public.wearable_connections $$, '42501', null, 'nor the refresh token');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select is((select count(*)::int from public.wearable_connections), 0, 'another patient sees none');
select throws_ok($$ insert into public.wearable_connections (patient_id, provider, connected_by, access_token_encrypted, refresh_token_encrypted, expires_at) values ('d0000000-0000-4000-8000-000000000002', 'oura', 'a0000000-0000-4000-8000-000000000012', 'x', 'y', now()) $$, '42501', null, 'and cannot write a link directly');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.wearable_connections), 2, 'a PA sees the status of every link');
select throws_ok($$ select access_token_encrypted from public.wearable_connections $$, '42501', null, 'and not the tokens');
reset role;

-- 3. Readings from the sync -----------------------------------------------------------------------

select pg_temp.service();
select throws_ok($$ select public.upsert_wearable_readings('d0000000-0000-4000-8000-000000000002', 'oura', '[]'::jsonb) $$, '22023', null, 'no readings for a patient with no link');
select is(public.upsert_wearable_readings('d0000000-0000-4000-8000-000000000001', 'oura', '[{"metric":"steps","value":8000,"measured_on":"2026-11-10"},{"metric":"sleep_score","value":81,"measured_on":"2026-11-10"}]'::jsonb), 2, 'the sync stores two readings');
select is(public.upsert_wearable_readings('d0000000-0000-4000-8000-000000000001', 'oura', '[{"metric":"steps","value":9000,"measured_on":"2026-11-10"}]'::jsonb), 1, 'and one more for the same day');
select is(public.upsert_wearable_readings('d0000000-0000-4000-8000-000000000001', 'oura', '[{"metric":"nonsense","value":1,"measured_on":"2026-11-10"},{"metric":"steps","value":99999999,"measured_on":"2026-11-10"},{"metric":"steps","value":5,"measured_on":"1999-01-01"},{"metric":"steps","value":5,"measured_on":"not a date"},{"value":5}]'::jsonb), 0, 'an unknown metric, a silly value, a bad day or a malformed row is skipped');
select is(public.upsert_wearable_readings('d0000000-0000-4000-8000-000000000001', 'oura', '[{"metric":"resting_heart_rate","value":3,"measured_on":"2026-11-10"},{"metric":"hrv_ms","value":55,"measured_on":"2026-11-10"}]'::jsonb), 1, 'a figure outside the metric''s range is skipped and the rest of the batch is kept');
select throws_ok($$ select public.upsert_wearable_readings('d0000000-0000-4000-8000-000000000001', 'oura', (select jsonb_agg(jsonb_build_object('metric','steps','value',1,'measured_on','2026-11-10')) from generate_series(1, 601))) $$, '22023', null, 'more than 600 at once is refused');
reset role;

select is((select count(*)::int from public.wearable_readings where patient_id = 'd0000000-0000-4000-8000-000000000001' and source = 'oura' and metric = 'steps'), 1, 'a day''s figure is kept once');
select is((select value from public.wearable_readings where patient_id = 'd0000000-0000-4000-8000-000000000001' and source = 'oura' and metric = 'steps'), 9000::numeric, 'with the latest value');
select is((select device from public.wearable_readings where patient_id = 'd0000000-0000-4000-8000-000000000001' and source = 'oura' limit 1), 'Oura', 'named for the device');
select ok((select entered_by is null from public.wearable_readings where patient_id = 'd0000000-0000-4000-8000-000000000001' and source = 'oura' limit 1), 'with nobody as the person who entered it');

select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.wearable_readings where source = 'oura'), 3, 'the patient sees what the sync stored');
update public.wearable_readings set archived_at = now() where source = 'oura';
reset role;
select is((select count(*)::int from public.wearable_readings where source = 'oura' and archived_at is null), 3, 'but cannot archive it');
select throws_ok($$ insert into public.wearable_readings (patient_id, metric, value, measured_on, source) values ('d0000000-0000-4000-8000-000000000001', 'steps', 1, '2026-11-11', 'manual') $$, '23514', null, 'a manual reading still needs someone who entered it');

-- 4. Syncing --------------------------------------------------------------------------------------

select pg_temp.service();
select is((select count(*)::int from public.wearable_connections_due(10)), 2, 'both links are due');
select lives_ok($$ select public.record_wearable_sync((select id from public.wearable_connections where provider = 'whoop' and patient_id = 'd0000000-0000-4000-8000-000000000001'), null, 'The provider no longer accepts the link.', true) $$, 'a refused link is recorded');
select is((select count(*)::int from public.wearable_connections_due(10)), 1, 'and is no longer due');
select lives_ok($$ select public.record_wearable_sync((select id from public.wearable_connections where provider = 'oura' and patient_id = 'd0000000-0000-4000-8000-000000000001'), '2026-11-12', null, false) $$, 'a good sync is recorded');
reset role;
select is((select synced_through from public.wearable_connections where provider = 'oura' and patient_id = 'd0000000-0000-4000-8000-000000000001'), '2026-11-12'::date, 'with the day it read to');
select ok((select needs_reconnect from public.wearable_connections where provider = 'whoop' and patient_id = 'd0000000-0000-4000-8000-000000000001'), 'the refused link asks to be connected again');

-- 5. Consent withdrawn ----------------------------------------------------------------------------

insert into public.consents (patient_id, consent_type, version, granted, changed_at) values ('d0000000-0000-4000-8000-000000000001', 'wearables', '2026-11', false, now() + interval '1 second');
select pg_temp.service();
select is((select count(*)::int from public.wearable_connections_due(10)), 0, 'nothing is due once consent is withdrawn');
select is((select count(*)::int from public.drop_unconsented_wearable_connections()), 2, 'both links are removed');
reset role;
select is((select count(*)::int from public.wearable_connections where patient_id = 'd0000000-0000-4000-8000-000000000001'), 0, 'and no link is left');
select is((select count(*)::int from public.wearable_readings where patient_id = 'd0000000-0000-4000-8000-000000000001' and source = 'oura'), 3, 'while the readings stay on the record');

-- 6. Disconnecting --------------------------------------------------------------------------------

insert into public.consents (patient_id, consent_type, version, granted, changed_at) values ('d0000000-0000-4000-8000-000000000001', 'wearables', '2026-11', true, now() + interval '2 seconds');
select pg_temp.service();
select lives_ok($$ select public.save_wearable_connection('d0000000-0000-4000-8000-000000000001', 'oura', 'a0000000-0000-4000-8000-000000000011', 'enc-a', 'enc-r', now() + interval '1 day', 'daily') $$, 'a patient who agreed again links once more');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000012');
select throws_ok($$ select public.disconnect_wearable('d0000000-0000-4000-8000-000000000001', 'oura') $$, '42501', null, 'another patient cannot disconnect it');
reset role;
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select lives_ok($$ select public.disconnect_wearable('d0000000-0000-4000-8000-000000000001', 'oura') $$, 'the patient disconnects');
reset role;
select is((select count(*)::int from public.wearable_connections where patient_id = 'd0000000-0000-4000-8000-000000000001'), 0, 'and the link is gone');

-- 7. Grants ---------------------------------------------------------------------------------------

select ok(not has_function_privilege('authenticated', 'public.save_wearable_connection(uuid, public.wearable_provider, uuid, text, text, timestamptz, text)', 'execute'), 'a signed-in person cannot save a link');
select ok(not has_function_privilege('authenticated', 'public.upsert_wearable_readings(uuid, public.wearable_provider, jsonb)', 'execute'), 'nor store synced readings');
select ok(not has_function_privilege('authenticated', 'public.wearable_connections_due(int)', 'execute'), 'nor list the links');
select ok(not has_function_privilege('anon', 'public.disconnect_wearable(uuid, public.wearable_provider)', 'execute'), 'anon cannot disconnect');
select ok(has_function_privilege('authenticated', 'public.disconnect_wearable(uuid, public.wearable_provider)', 'execute'), 'a signed-in person can ask to disconnect, and the database checks who');

select * from finish();
rollback;
