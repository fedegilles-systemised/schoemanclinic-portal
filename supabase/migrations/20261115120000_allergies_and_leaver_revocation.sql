-- Two small points finished on 11 November 2026.
--
--   1. An allergy entered by mistake can be removed. Nothing is deleted: the row is archived, and the
--      audit log keeps who did it. Doctors, nurses and PAs, who record allergies, may do it.
--   2. When a team member is switched off, their Google access is withdrawn at Google too. The
--      database cannot call Google or read the token (the server encrypts it), so the leaver trigger
--      queues the encrypted token for the server, which revokes it and then clears it.

-- 1. Allergies ------------------------------------------------------------------------------------

alter table public.patient_allergies add column archived_at timestamptz;
comment on column public.patient_allergies.archived_at is 'Set when an allergy was entered by mistake. Archived allergies are not shown.';
grant update (archived_at) on public.patient_allergies to authenticated;

-- 2. Revoking a leaver's Google access ------------------------------------------------------------

create table public.google_revocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  refresh_token_encrypted text check (refresh_token_encrypted is null or char_length(refresh_token_encrypted) between 1 and 4000),
  queued_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.google_revocations is 'Google tokens of team members who were switched off, waiting for the server to revoke them at Google. The token is cleared once revoked. Server only.';
create index google_revocations_pending_idx on public.google_revocations (queued_at) where revoked_at is null;
create index google_revocations_user_idx on public.google_revocations (user_id);

alter table public.google_revocations enable row level security;
alter table public.google_revocations force row level security;
revoke all on table public.google_revocations from public, anon, authenticated, service_role;
-- The server reads the queue and marks each one done. Nobody signed in sees it.
grant select, update (refresh_token_encrypted, attempts, revoked_at) on public.google_revocations to service_role;

create or replace function private.drop_leaver_connections()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (not new.active or new.archived_at is not null) and (old.active and old.archived_at is null) then
    perform set_config('app.system_actor', 'offboarding', true);
    insert into public.google_revocations (user_id, refresh_token_encrypted)
    select c.user_id, c.refresh_token_encrypted from public.google_calendar_connections c where c.user_id = new.user_id;
    delete from public.google_calendar_connections where user_id = new.user_id;
  end if;
  return new;
end;
$$;
comment on function private.drop_leaver_connections() is 'Trigger: a team member switched off loses their Google connection at once; the token is queued for the server to revoke at Google.';
