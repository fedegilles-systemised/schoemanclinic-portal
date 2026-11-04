-- S-23: when the sign-in service changes a person's email (after they confirm it), the
-- profile's copy follows. A person cannot change profiles.email themselves.
create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(new.email, '')
  where id = new.id and email is distinct from coalesce(new.email, '');
  return null;
end;
$$;
comment on function private.sync_profile_email() is 'Trigger on auth.users email update: keeps profiles.email in step with the confirmed sign-in email.';

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_profile_email();
