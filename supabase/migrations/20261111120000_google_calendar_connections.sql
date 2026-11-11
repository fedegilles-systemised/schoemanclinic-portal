-- Staff can connect their own Google Calendar to Clinic Hub, see their events and add,
-- change or delete them from the clinic portal.
--
-- One row per staff member. The refresh token is encrypted by the server before it is
-- stored (AES-256-GCM, key in GOOGLE_TOKEN_ENCRYPTION_KEY), so the database never holds it
-- in the clear. Signed-in people read only their own row, and never the token column.
-- Writes go through two functions that only the service role can run, so each change is
-- written to the audit log under the staff member it belongs to.

create table public.google_calendar_connections (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  google_email text not null check (char_length(google_email) between 3 and 320),
  refresh_token_encrypted text not null check (char_length(refresh_token_encrypted) between 1 and 4000),
  scope text not null check (char_length(scope) between 1 and 2000),
  calendar_id text not null default 'primary' check (char_length(calendar_id) between 1 and 320),
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.google_calendar_connections is 'A staff member''s link to their own Google Calendar. The token is encrypted by the server and is read by server code only.';
comment on column public.google_calendar_connections.google_email is 'The Google account they connected, shown to them on the Calendar screen.';
comment on column public.google_calendar_connections.refresh_token_encrypted is 'AES-256-GCM, encrypted with GOOGLE_TOKEN_ENCRYPTION_KEY. Never granted to signed-in users.';
comment on column public.google_calendar_connections.calendar_id is 'The Google calendar shown and written to. primary is their main calendar.';

create trigger google_calendar_connections_set_updated_at before update on public.google_calendar_connections
  for each row execute function private.set_updated_at();
create trigger google_calendar_connections_write_audit_log after insert or update or delete on public.google_calendar_connections
  for each row execute function private.write_audit_log();

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_connections force row level security;

revoke all on table public.google_calendar_connections from public, anon, authenticated, service_role;
-- Signed-in people see whether they are connected and to which account, never the token.
grant select (user_id, google_email, calendar_id, connected_at) on public.google_calendar_connections to authenticated;
-- Server code reads the token to call Google. It writes only through the functions below.
grant select on public.google_calendar_connections to service_role;

create policy "Active staff read their own Google Calendar connection" on public.google_calendar_connections
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_staff((select auth.uid()))));

-- Saves or replaces a staff member's connection. Called by the OAuth callback after it has
-- checked who is signed in. Only active staff can be connected.
create function private.save_google_calendar_connection(
  _user uuid,
  _google_email text,
  _refresh_token_encrypted text,
  _scope text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_staff(_user)
     or exists (select 1 from public.profiles p where p.id = _user and p.status = 'suspended') then
    raise exception 'Only active team members can connect a calendar.' using errcode = '42501';
  end if;
  perform set_config('app.actor_id', _user::text, true);
  insert into public.google_calendar_connections (user_id, google_email, refresh_token_encrypted, scope)
  values (_user, lower(btrim(_google_email)), _refresh_token_encrypted, _scope)
  on conflict (user_id) do update
    set google_email = excluded.google_email,
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        scope = excluded.scope,
        connected_at = now();
end;
$$;
comment on function private.save_google_calendar_connection(uuid, text, text, text) is 'Service role only: stores a staff member''s encrypted Google token, logged under that person.';

-- Removes a connection. A credential, not a clinical record, so it is deleted rather than
-- archived: nothing that can call Google is kept once someone disconnects or leaves.
create function private.remove_google_calendar_connection(_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.actor_id', _user::text, true);
  delete from public.google_calendar_connections where user_id = _user;
end;
$$;
comment on function private.remove_google_calendar_connection(uuid) is 'Service role only: deletes a staff member''s Google token, logged under that person.';

create function public.save_google_calendar_connection(
  _user uuid, _google_email text, _refresh_token_encrypted text, _scope text
)
returns void language sql security invoker set search_path = ''
as $$ select private.save_google_calendar_connection(_user, _google_email, _refresh_token_encrypted, _scope); $$;

create function public.remove_google_calendar_connection(_user uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.remove_google_calendar_connection(_user); $$;

revoke all on function
  private.save_google_calendar_connection(uuid, text, text, text),
  private.remove_google_calendar_connection(uuid),
  public.save_google_calendar_connection(uuid, text, text, text),
  public.remove_google_calendar_connection(uuid)
from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function
  private.save_google_calendar_connection(uuid, text, text, text),
  private.remove_google_calendar_connection(uuid),
  public.save_google_calendar_connection(uuid, text, text, text),
  public.remove_google_calendar_connection(uuid)
to service_role;
