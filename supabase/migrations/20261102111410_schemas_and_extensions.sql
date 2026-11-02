-- Schemas, extensions and closed-by-default privileges.

-- Internal functions live here. This schema is not exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
comment on schema private is 'Internal helpers and trigger functions. Never exposed through the Data API.';

-- GraphQL is not used. Removing it means table names are not discoverable through it.
drop extension if exists pg_graphql;

-- New objects start closed: tables, sequences and functions must be granted one by one.
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;
alter default privileges revoke execute on functions from public;

-- One shared trigger keeps updated_at.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
comment on function private.set_updated_at() is 'Shared trigger: keeps updated_at on any table that has it.';

-- Rejects changes to the named columns when they come from a signed-in client.
-- Server code (service role) and migrations are not affected.
create function private.reject_client_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
begin
  if current_user = 'authenticated' then
    foreach col in array tg_argv loop
      if (to_jsonb(new) -> col) is distinct from (to_jsonb(old) -> col) then
        raise exception 'Column %.% cannot be changed from the client.', tg_table_name, col
          using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
comment on function private.reject_client_changes() is 'Trigger: rejects client changes to the columns passed as arguments. A second lock behind the column grants.';
