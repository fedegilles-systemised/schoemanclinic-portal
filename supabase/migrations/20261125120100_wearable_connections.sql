-- Wearables connected directly: a patient, or a guardian who can act for them, links an Oura or WHOOP
-- account. Clinic Hub then reads their daily figures each day and stores them as wearable readings,
-- next to the ones typed in by hand.
--
--   1. Which accounts are linked, with the tokens encrypted by the server (AES-256-GCM).
--   2. Where a reading came from, and room for readings written by the sync rather than a person.
--   3. Functions: save and remove a link, record a sync, store readings, list links that are due.
--
-- Nothing here is deleted but a credential: disconnecting removes the link and its tokens, while the
-- readings stay on the record.

-- 1. Linked accounts -------------------------------------------------------------------------------

create type public.wearable_provider as enum ('oura', 'whoop');

create table public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  provider public.wearable_provider not null,
  access_token_encrypted text not null check (char_length(access_token_encrypted) between 1 and 4000),
  refresh_token_encrypted text not null check (char_length(refresh_token_encrypted) between 1 and 4000),
  expires_at timestamptz not null,
  scope text not null default '' check (char_length(scope) <= 2000),
  connected_by uuid not null references public.profiles (id) on delete restrict,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  synced_through date,
  last_error text check (char_length(last_error) <= 200),
  needs_reconnect boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wearable_connections_one_per_provider unique (patient_id, provider)
);
comment on table public.wearable_connections is 'A patient''s linked Oura or WHOOP account. The tokens are encrypted by the server and read by server code only.';
comment on column public.wearable_connections.access_token_encrypted is 'AES-256-GCM with WEARABLE_TOKEN_ENCRYPTION_KEY. Never granted to signed-in users.';
comment on column public.wearable_connections.refresh_token_encrypted is 'AES-256-GCM with WEARABLE_TOKEN_ENCRYPTION_KEY. Never granted to signed-in users.';
comment on column public.wearable_connections.synced_through is 'The last day whose figures were read.';
comment on column public.wearable_connections.last_error is 'A short fixed sentence about the last failed sync. Never a token or a message from the provider.';
comment on column public.wearable_connections.needs_reconnect is 'The provider no longer accepts the link: the patient has to connect again.';
create index wearable_connections_connected_by_idx on public.wearable_connections (connected_by);

create trigger wearable_connections_set_updated_at before update on public.wearable_connections
  for each row execute function private.set_updated_at();
create trigger wearable_connections_write_audit_log after insert or update or delete on public.wearable_connections
  for each row execute function private.write_audit_log();

alter table public.wearable_connections enable row level security;
alter table public.wearable_connections force row level security;
revoke all on table public.wearable_connections from public, anon, authenticated, service_role;
-- Signed-in people see that an account is linked and how it is going, never the tokens.
grant select (id, patient_id, provider, scope, connected_by, connected_at, last_synced_at, synced_through, needs_reconnect)
  on public.wearable_connections to authenticated;
-- Server code reads the tokens to call the provider. It writes only through the functions below.
grant select on public.wearable_connections to service_role;

create policy "Patients, guardians and staff in scope read wearable connections" on public.wearable_connections
  for select to authenticated
  using (patient_id in (select private.my_patient_ids()) or private.in_scope(patient_id));

-- 2. Where a reading came from ---------------------------------------------------------------------

alter table public.wearable_readings
  add column source text not null default 'manual' check (source in ('manual', 'oura', 'whoop'));
alter table public.wearable_readings alter column entered_by drop not null;
alter table public.wearable_readings
  add constraint wearable_readings_entered_by_manual check (source <> 'manual' or entered_by is not null);
comment on column public.wearable_readings.source is 'manual for a reading someone typed in; otherwise the provider the sync read it from.';
comment on column public.wearable_readings.entered_by is 'Who typed a manual reading. Empty for a reading read by the sync.';
-- One synced figure per patient, metric, day and provider: a later sync updates it instead of adding another.
create unique index wearable_readings_synced_idx on public.wearable_readings (patient_id, metric, measured_on, source)
  where source <> 'manual' and archived_at is null;

-- 3. Functions -------------------------------------------------------------------------------------

create function private.person_can_act_for(_person uuid, _patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patient_profiles pp join public.profiles p on p.id = pp.user_id
    where pp.id = _patient and pp.user_id = _person and pp.archived_at is null and p.status <> 'suspended'
  ) or exists (
    select 1
    from public.patient_guardians g
    join public.profiles p on p.id = g.guardian_user_id
    join public.patient_profiles pp on pp.id = g.patient_id and pp.archived_at is null
    where g.patient_id = _patient and g.guardian_user_id = _person
      and g.can_act and g.verified_by is not null and p.status <> 'suspended'
  );
$$;

create function private.has_wearable_consent(_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted from public.consents c
    where c.patient_id = _patient and c.consent_type = 'wearables'
    order by c.changed_at desc, c.created_at desc limit 1
  ), false);
$$;

-- Links an account. Called by the OAuth callback after it has checked who is signed in. The person must
-- be able to act for the patient, and the patient must have agreed to wearables.
create function private.save_wearable_connection(
  _patient uuid, _provider public.wearable_provider, _by uuid,
  _access_encrypted text, _refresh_encrypted text, _expires_at timestamptz, _scope text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conn_id uuid;
begin
  if not private.person_can_act_for(_by, _patient) then
    raise exception 'Only the patient, or a guardian who can act for them, can connect a wearable.' using errcode = '42501';
  end if;
  if not private.has_wearable_consent(_patient) then
    raise exception 'Agree to wearables first.' using errcode = '22023';
  end if;
  perform set_config('app.actor_id', _by::text, true);
  insert into public.wearable_connections (patient_id, provider, connected_by, access_token_encrypted, refresh_token_encrypted, expires_at, scope)
  values (_patient, _provider, _by, _access_encrypted, _refresh_encrypted, _expires_at, coalesce(_scope, ''))
  on conflict (patient_id, provider) do update
    set connected_by = excluded.connected_by,
        access_token_encrypted = excluded.access_token_encrypted,
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        expires_at = excluded.expires_at,
        scope = excluded.scope,
        connected_at = now(),
        needs_reconnect = false,
        last_error = null
  returning id into conn_id;
  return conn_id;
end;
$$;

-- The sync has a new token pair from the provider.
create function private.update_wearable_tokens(
  _connection uuid, _access_encrypted text, _refresh_encrypted text, _expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'wearable-sync', true);
  update public.wearable_connections
    set access_token_encrypted = _access_encrypted, refresh_token_encrypted = _refresh_encrypted, expires_at = _expires_at
    where id = _connection;
  perform set_config('app.system_actor', '', true);
end;
$$;

-- How a sync went. A message of null means it worked. needs_reconnect says the provider refused the link.
create function private.record_wearable_sync(_connection uuid, _through date, _error text, _needs_reconnect boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'wearable-sync', true);
  update public.wearable_connections
    set last_synced_at = case when _error is null then now() else last_synced_at end,
        synced_through = case when _error is null then coalesce(_through, synced_through) else synced_through end,
        last_error = left(_error, 200),
        needs_reconnect = coalesce(_needs_reconnect, false)
    where id = _connection;
  perform set_config('app.system_actor', '', true);
end;
$$;

-- Stores the figures a sync read: [{"metric": "steps", "value": 8000, "measured_on": "2026-11-20"}, ...].
-- Only for a patient with a linked account for that provider, only a recognised metric, a sane value and
-- a plausible day. A figure for the same day is updated, never doubled.
create function private.upsert_wearable_readings(_patient uuid, _provider public.wearable_provider, _rows jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  stored int := 0;
  metric_value public.wearable_metric;
  val numeric;
  day date;
begin
  if jsonb_typeof(_rows) is distinct from 'array' or jsonb_array_length(_rows) > 600 then
    raise exception 'Send up to 600 readings as a list.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.wearable_connections c where c.patient_id = _patient and c.provider = _provider) then
    raise exception 'No wearable is linked for that patient.' using errcode = '22023';
  end if;
  perform set_config('app.system_actor', 'wearable-sync', true);
  for item in select * from jsonb_array_elements(_rows) loop
    begin
      metric_value := (item ->> 'metric')::public.wearable_metric;
      val := (item ->> 'value')::numeric;
      day := (item ->> 'measured_on')::date;
    exception when others then
      continue;
    end;
    if val is null or val <= -1000000 or val >= 1000000 or day is null or day < date '2000-01-01' or day > current_date + 1 then
      continue;
    end if;
    -- The table's own range check for each metric can refuse a figure: skip that one, keep the rest.
    begin
      insert into public.wearable_readings (patient_id, metric, value, measured_on, device, entered_by, source)
      values (_patient, metric_value, val, day, case _provider when 'oura' then 'Oura' else 'WHOOP' end, null, _provider::text)
      on conflict (patient_id, metric, measured_on, source) where source <> 'manual' and archived_at is null
      do update set value = excluded.value;
      stored := stored + 1;
    exception when others then
      continue;
    end;
  end loop;
  perform set_config('app.system_actor', '', true);
  return stored;
end;
$$;

-- The linked accounts whose daily read is due: not told to reconnect, and the patient still agrees.
create function private.wearable_connections_due(_limit int)
returns table (
  id uuid, patient_id uuid, provider public.wearable_provider,
  access_token_encrypted text, refresh_token_encrypted text, expires_at timestamptz, synced_through date
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.patient_id, c.provider, c.access_token_encrypted, c.refresh_token_encrypted, c.expires_at, c.synced_through
  from public.wearable_connections c
  join public.patient_profiles pp on pp.id = c.patient_id and pp.archived_at is null
  where not c.needs_reconnect
    and private.has_wearable_consent(c.patient_id)
  order by coalesce(c.last_synced_at, 'epoch'::timestamptz)
  limit greatest(_limit, 1);
$$;

-- A patient who withdrew their consent, or whose record is archived, no longer has a link. Returns the
-- providers and tokens so server code can ask the provider to revoke them; here the credential is removed.
create function private.drop_unconsented_wearable_connections()
returns table (provider public.wearable_provider, access_token_encrypted text, refresh_token_encrypted text, patient_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'wearable-sync', true);
  return query
    with gone as (
      delete from public.wearable_connections c
      where not private.has_wearable_consent(c.patient_id)
         or exists (select 1 from public.patient_profiles pp where pp.id = c.patient_id and pp.archived_at is not null)
      returning c.provider, c.access_token_encrypted, c.refresh_token_encrypted, c.patient_id
    )
    select g.provider, g.access_token_encrypted, g.refresh_token_encrypted, g.patient_id from gone g;
  perform set_config('app.system_actor', '', true);
end;
$$;

-- A patient, or a guardian who can act, unlinks an account. The credential is removed; readings stay.
create function private.disconnect_wearable(_patient uuid, _provider public.wearable_provider)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_act_for(_patient) then
    raise exception 'Only the patient, or a guardian who can act for them, can disconnect a wearable.' using errcode = '42501';
  end if;
  delete from public.wearable_connections where patient_id = _patient and provider = _provider;
end;
$$;

-- Wrappers and grants ------------------------------------------------------------------------------

create function public.save_wearable_connection(
  _patient uuid, _provider public.wearable_provider, _by uuid,
  _access_encrypted text, _refresh_encrypted text, _expires_at timestamptz, _scope text
) returns uuid language sql security invoker set search_path = ''
as $$ select private.save_wearable_connection(_patient, _provider, _by, _access_encrypted, _refresh_encrypted, _expires_at, _scope); $$;
create function public.update_wearable_tokens(_connection uuid, _access_encrypted text, _refresh_encrypted text, _expires_at timestamptz)
returns void language sql security invoker set search_path = ''
as $$ select private.update_wearable_tokens(_connection, _access_encrypted, _refresh_encrypted, _expires_at); $$;
create function public.record_wearable_sync(_connection uuid, _through date, _error text, _needs_reconnect boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.record_wearable_sync(_connection, _through, _error, _needs_reconnect); $$;
create function public.upsert_wearable_readings(_patient uuid, _provider public.wearable_provider, _rows jsonb)
returns int language sql security invoker set search_path = ''
as $$ select private.upsert_wearable_readings(_patient, _provider, _rows); $$;
create function public.wearable_connections_due(_limit int)
returns table (
  id uuid, patient_id uuid, provider public.wearable_provider,
  access_token_encrypted text, refresh_token_encrypted text, expires_at timestamptz, synced_through date
) language sql stable security invoker set search_path = ''
as $$ select * from private.wearable_connections_due(_limit); $$;
create function public.drop_unconsented_wearable_connections()
returns table (provider public.wearable_provider, access_token_encrypted text, refresh_token_encrypted text, patient_id uuid)
language sql security invoker set search_path = ''
as $$ select * from private.drop_unconsented_wearable_connections(); $$;
create function public.disconnect_wearable(_patient uuid, _provider public.wearable_provider)
returns void language sql security invoker set search_path = ''
as $$ select private.disconnect_wearable(_patient, _provider); $$;

revoke all on function
  private.person_can_act_for(uuid, uuid), private.has_wearable_consent(uuid),
  private.save_wearable_connection(uuid, public.wearable_provider, uuid, text, text, timestamptz, text),
  private.update_wearable_tokens(uuid, text, text, timestamptz),
  private.record_wearable_sync(uuid, date, text, boolean),
  private.upsert_wearable_readings(uuid, public.wearable_provider, jsonb),
  private.wearable_connections_due(int),
  private.drop_unconsented_wearable_connections(),
  private.disconnect_wearable(uuid, public.wearable_provider),
  public.save_wearable_connection(uuid, public.wearable_provider, uuid, text, text, timestamptz, text),
  public.update_wearable_tokens(uuid, text, text, timestamptz),
  public.record_wearable_sync(uuid, date, text, boolean),
  public.upsert_wearable_readings(uuid, public.wearable_provider, jsonb),
  public.wearable_connections_due(int),
  public.drop_unconsented_wearable_connections(),
  public.disconnect_wearable(uuid, public.wearable_provider)
from public, anon, authenticated;

grant execute on function
  private.person_can_act_for(uuid, uuid), private.has_wearable_consent(uuid),
  private.save_wearable_connection(uuid, public.wearable_provider, uuid, text, text, timestamptz, text),
  private.update_wearable_tokens(uuid, text, text, timestamptz),
  private.record_wearable_sync(uuid, date, text, boolean),
  private.upsert_wearable_readings(uuid, public.wearable_provider, jsonb),
  private.wearable_connections_due(int),
  private.drop_unconsented_wearable_connections(),
  public.save_wearable_connection(uuid, public.wearable_provider, uuid, text, text, timestamptz, text),
  public.update_wearable_tokens(uuid, text, text, timestamptz),
  public.record_wearable_sync(uuid, date, text, boolean),
  public.upsert_wearable_readings(uuid, public.wearable_provider, jsonb),
  public.wearable_connections_due(int),
  public.drop_unconsented_wearable_connections()
to service_role;

-- The patient's own side: disconnecting runs as the signed-in person, so the database checks who they are.
grant execute on function private.disconnect_wearable(uuid, public.wearable_provider), public.disconnect_wearable(uuid, public.wearable_provider) to authenticated;
