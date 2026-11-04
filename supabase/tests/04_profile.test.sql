-- Profile: the email follows the sign-in service, and signatures stay private.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Gina (doctor), Eleanor (patient), Tom (PA): ids from supabase/seed.sql.
-- Files uploaded by hand on this machine may already exist, and storage does not allow direct
-- deletes, so they are renamed out of the way. The whole test is rolled back.
update storage.objects set name = 'moved/' || name where bucket_id in ('signatures', 'avatars') and name ~ '/(signature|avatar)$';
update auth.users set email = 'gina.new@example.test' where id = 'a0000000-0000-4000-8000-000000000001';
select is(
  (select email from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'gina.new@example.test', 'a confirmed change of sign-in email reaches the profile');

create function pg_temp.become(_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- The doctor stores her signature at her own exact path.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('signatures', 'a0000000-0000-4000-8000-000000000001/signature', 'a0000000-0000-4000-8000-000000000001') $$, 'a doctor can store her own signature');
select is((select count(*)::int from storage.objects where bucket_id = 'signatures' and name = 'a0000000-0000-4000-8000-000000000001/signature'), 1, 'and read it');
reset role;

-- Nobody else can store at her path, or at any other name in her folder.
select pg_temp.become('a0000000-0000-4000-8000-000000000001');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('signatures', 'a0000000-0000-4000-8000-000000000001/other', 'a0000000-0000-4000-8000-000000000001') $$, '42501', null, 'only the exact signature path is accepted');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('signatures', 'a0000000-0000-4000-8000-000000000004/signature', 'a0000000-0000-4000-8000-000000000001') $$, '42501', null, 'a doctor cannot store into someone else''s folder');
reset role;

-- A patient cannot store a signature, and cannot read the doctor's.
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('signatures', 'a0000000-0000-4000-8000-000000000011/signature', 'a0000000-0000-4000-8000-000000000011') $$, '42501', null, 'a patient cannot store a signature');
select is((select count(*)::int from storage.objects where bucket_id = 'signatures'), 0, 'a patient cannot read the doctor''s signature');
reset role;

-- The PA is not a doctor, and does not see it either.
select pg_temp.become('a0000000-0000-4000-8000-000000000004');
select is((select count(*)::int from storage.objects where bucket_id = 'signatures'), 0, 'a PA cannot read a doctor''s signature');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('signatures', 'a0000000-0000-4000-8000-000000000004/signature', 'a0000000-0000-4000-8000-000000000004') $$, '42501', null, 'a PA cannot store a signature');
reset role;

-- Photos: only the exact path is accepted (S-70).
select pg_temp.become('a0000000-0000-4000-8000-000000000011');
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('avatars', 'a0000000-0000-4000-8000-000000000011/avatar', 'a0000000-0000-4000-8000-000000000011') $$, 'a person can store their photo at the exact path');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id) values ('avatars', 'a0000000-0000-4000-8000-000000000011/notes.png', 'a0000000-0000-4000-8000-000000000011') $$, '42501', null, 'any other name in their folder is refused');

-- Name and phone have limits (S-71).
select throws_ok($$ update public.profiles set full_name = repeat('x', 121) where id = 'a0000000-0000-4000-8000-000000000011' $$, '23514', null, 'a name over 120 characters is refused');
select throws_ok($$ update public.profiles set phone = '<script>alert(1)</script>' where id = 'a0000000-0000-4000-8000-000000000011' $$, '23514', null, 'a phone number with letters or markup is refused');
select lives_ok($$ update public.profiles set phone = '+44 20 7946 0000' where id = 'a0000000-0000-4000-8000-000000000011' $$, 'a normal phone number is accepted');
reset role;

select * from finish();
rollback;
