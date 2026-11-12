-- Structural guarantees: RLS, grants, foreign keys and indexes.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is((select count(*)::int from pg_tables where schemaname = 'public'), 47, '47 tables in public');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity)),
  0, 'RLS is enabled and forced on every table');
select is((select count(*)::int from pg_policy where polcmd = '*'), 0, 'no FOR ALL policies');
select is(
  (select count(*)::int from pg_constraint c join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public' and c.contype = 'f' and c.confdeltype in ('c', 'n', 'd')),
  0, 'no foreign key cascades or sets null on delete');
select is(
  (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'PUBLIC')),
  0, 'anon and public hold no table grants');
select is(
  (select count(*)::int from information_schema.role_routine_grants where routine_schema in ('public', 'private') and grantee in ('anon', 'PUBLIC')),
  0, 'anon and public hold no function grants');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated' and table_name in ('webhook_events', 'integration_sync_log', 'audit_log')),
  0, 'authenticated holds nothing on the server-only tables');
select is(
  (select coalesce(array_agg(table_name::text order by table_name), '{}') from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'DELETE'),
  array['lab_panel_markers', 'staff_locations'],
  'authenticated can delete only from two non-clinical join tables');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prokind = 'f'
     and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
  0, 'every function sets search_path');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef),
  0, 'no SECURITY DEFINER function in the exposed schema');
select is(
  (select count(*)::int
   from pg_constraint c
   join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public' and c.contype = 'f'
     and not exists (
       select 1 from pg_index i
       where i.indrelid = c.conrelid
         and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
     )),
  0, 'every foreign key has an index');
select is(
  (select count(*)::int from storage.buckets where id in ('documents', 'avatars') and not public and file_size_limit is not null and allowed_mime_types is not null),
  2, 'both buckets are private with size and type limits');

select * from finish();
rollback;
