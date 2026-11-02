-- Identity and accounts. auth.users belongs to Supabase: referenced, never altered.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text not null default '',
  email text not null,
  phone text,
  avatar_path text,
  locale text not null default 'en-GB',
  status public.account_status not null default 'invited',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row for every person who can sign in. Shares its id with the Supabase Auth account. Accounts are suspended through status, never deleted.';
comment on column public.profiles.avatar_path is 'Path in the avatars storage bucket, starting with this user id.';
comment on column public.profiles.status is 'invited, active or suspended. Changed by an admin. Suspended accounts fail every role and patient check, so they reach no clinical data.';
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Creates the profiles row when Supabase Auth creates an account.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
comment on function private.handle_new_user() is 'Trigger on auth.users insert: creates the matching profiles row. Grants no role.';
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete restrict,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, role),
  constraint user_roles_not_self_granted check (granted_by is null or granted_by <> user_id)
);
comment on table public.user_roles is 'Which roles each person has; a person can hold more than one. Written only by server code. Guardians hold no role of their own: see patient_guardians.';
comment on column public.user_roles.granted_by is 'Who granted the role. Empty for the first admin and seed data. Can never be the person themselves.';
create index user_roles_granted_by_idx on public.user_roles (granted_by);

-- invitations.patient_id and invited_by get their foreign keys in the patient record migration.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null,
  patient_id uuid,
  invited_by uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_token_hash_length check (length(token_hash) >= 32),
  constraint invitations_expiry_is_short check (expires_at <= created_at + interval '14 days')
);
comment on table public.invitations is 'An invitation to create an account, sent through Resend. Sign-up is invitation only. Created and accepted by server code, which generates the token, so an inviter never knows it.';
comment on column public.invitations.token_hash is 'Hash of the token, never the token itself. Not readable by any signed-in user.';
create unique index invitations_one_pending_per_email on public.invitations (lower(email)) where accepted_at is null;
create index invitations_patient_id_idx on public.invitations (patient_id);
create index invitations_invited_by_idx on public.invitations (invited_by);

create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete restrict,
  topic public.notification_topic not null,
  channel public.notification_channel not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic, channel)
);
comment on table public.notification_preferences is 'How each person wants to hear about each kind of event. GoHighLevel reads this before sending.';
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  topic public.notification_topic not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'Alerts inside the portal, under the bell icon. Created by the server; the person can only mark their own as read.';
comment on column public.notifications.link is 'Where it opens in the portal.';
create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
