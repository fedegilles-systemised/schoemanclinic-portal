-- Limits sign-in and password reset attempts per address and per account (docs/SECURITY.md, S-32).
-- Keys are hashes made by the server, so the table holds no plain email or IP address.
create table private.auth_throttle (
  key_hash text primary key,
  attempts integer not null check (attempts > 0),
  window_ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
comment on table private.auth_throttle is 'Attempt counters for sign-in and password reset. Short-lived, and purged as they expire.';
create index auth_throttle_window_ends_at_idx on private.auth_throttle (window_ends_at);
revoke all on private.auth_throttle from public, anon, authenticated, service_role;

create function private.auth_throttle_hit(_keys text[], _limits integer[], _window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.auth_throttle where window_ends_at <= now();

  -- A refused attempt counts nowhere, so someone blocked on their own address
  -- cannot go on using up the limit of the account they are targeting.
  if exists (
    select 1
    from unnest(_keys, _limits) as bucket(key_hash, attempt_limit)
    join private.auth_throttle t on t.key_hash = bucket.key_hash
    where t.attempts >= bucket.attempt_limit
  ) then
    return false;
  end if;

  insert into private.auth_throttle (key_hash, attempts, window_ends_at)
  select key_hash, 1, now() + make_interval(secs => _window_seconds)
  from unnest(_keys) as key_hash
  on conflict (key_hash) do update set attempts = private.auth_throttle.attempts + 1;

  return true;
end;
$$;
comment on function private.auth_throttle_hit(text[], integer[], integer) is 'Counts one attempt in every bucket, or refuses it if any bucket is full. Concurrent calls can overshoot a limit slightly.';

create function public.auth_throttle_hit(_keys text[], _limits integer[], _window_seconds integer)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.auth_throttle_hit(_keys, _limits, _window_seconds);
$$;
comment on function public.auth_throttle_hit(text[], integer[], integer) is 'Server code only: called with the service role by lib/auth/throttle.ts.';

revoke all on function private.auth_throttle_hit(text[], integer[], integer) from public, anon, authenticated;
revoke all on function public.auth_throttle_hit(text[], integer[], integer) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.auth_throttle_hit(text[], integer[], integer) to service_role;
grant execute on function public.auth_throttle_hit(text[], integer[], integer) to service_role;
