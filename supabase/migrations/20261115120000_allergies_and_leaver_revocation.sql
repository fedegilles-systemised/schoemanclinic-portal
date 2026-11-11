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
    perform set_config('app.system_actor', '', true);
  end if;
  return new;
end;
$$;
comment on function private.drop_leaver_connections() is 'Trigger: a team member switched off loses their Google connection at once; the token is queued for the server to revoke at Google.';

-- An archived allergy is hidden from the patient side, and nobody edits or restores it.
alter policy "Patients, guardians and staff in scope read allergies" on public.patient_allergies
  using (((archived_at is null) and (patient_id in (select private.my_patient_ids()))) or private.in_scope(patient_id));
alter policy "Doctors and PAs change allergies" on public.patient_allergies
  using (
    ((select private.has_role('doctor')) or (select private.has_role('nurse')) or (select private.has_role('pa')))
    and private.in_scope(patient_id)
    and archived_at is null
  );

-- Suspending an account (profiles.status) also ends that person's Google connection, as switching
-- off their staff profile does.
create function private.drop_suspended_connections()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'suspended' and old.status is distinct from 'suspended'
     and exists (select 1 from public.google_calendar_connections c where c.user_id = new.id) then
    perform set_config('app.system_actor', 'offboarding', true);
    insert into public.google_revocations (user_id, refresh_token_encrypted)
    select c.user_id, c.refresh_token_encrypted from public.google_calendar_connections c where c.user_id = new.id;
    delete from public.google_calendar_connections where user_id = new.id;
    perform set_config('app.system_actor', '', true);
  end if;
  return new;
end;
$$;
comment on function private.drop_suspended_connections() is 'Trigger: a suspended account loses its Google connection; the token is queued for revocation at Google.';
revoke all on function private.drop_suspended_connections() from public, anon, authenticated;
create trigger profiles_drop_suspended_connections after update of status on public.profiles
  for each row execute function private.drop_suspended_connections();

-- The time an allergy is removed is the database's, not the caller's.
create function private.stamp_allergy_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    new.archived_at := now();
  end if;
  return new;
end;
$$;
create trigger patient_allergies_stamp_archive before update of archived_at on public.patient_allergies
  for each row execute function private.stamp_allergy_archive();

-- The server marks queue rows through one function that names itself in the audit log, instead of
-- updating the table directly. A cleared token can only be cleared: never set to something else.
alter table public.google_revocations add constraint google_revocations_cleared_when_revoked
  check (revoked_at is null or refresh_token_encrypted is null);
create trigger google_revocations_write_audit_log after insert or update or delete on public.google_revocations
  for each row execute function private.write_audit_log();
revoke update on public.google_revocations from service_role;

create function private.mark_google_revocation(_id uuid, _revoked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.system_actor', 'google-revocation', true);
  if _revoked then
    update public.google_revocations set revoked_at = now(), refresh_token_encrypted = null where id = _id and revoked_at is null;
  else
    update public.google_revocations set attempts = attempts + 1 where id = _id and revoked_at is null;
  end if;
  perform set_config('app.system_actor', '', true);
end;
$$;
comment on function private.mark_google_revocation(uuid, boolean) is 'Server only: marks a queued Google token revoked (and clears it), or counts a failed try.';
create function public.mark_google_revocation(_id uuid, _revoked boolean)
returns void language sql security invoker set search_path = '' as $$ select private.mark_google_revocation(_id, _revoked); $$;
revoke all on function private.mark_google_revocation(uuid, boolean), public.mark_google_revocation(uuid, boolean) from public, anon, authenticated;
grant execute on function private.mark_google_revocation(uuid, boolean), public.mark_google_revocation(uuid, boolean) to service_role;
