-- Integrations and compliance. No signed-in user touches these tables.

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source public.webhook_source not null,
  external_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status public.webhook_status not null default 'received',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint webhook_events_source_event_unique unique (source, external_event_id)
);
comment on table public.webhook_events is 'Every message pushed to us by Stripe, TDL or GoHighLevel, stored first and then processed. The unique event id stops a payment being handled twice.';

create table public.integration_sync_log (
  id bigint generated always as identity primary key,
  system public.sync_system not null,
  direction public.sync_direction not null,
  entity text not null,
  entity_id uuid,
  external_id text,
  status public.sync_status not null,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.integration_sync_log is 'Every time we read from or write to another system: what moved, when, and whether it worked.';
comment on column public.integration_sync_log.entity is 'Our table.';
comment on column public.integration_sync_log.external_id is 'Their id.';
create index integration_sync_log_entity_idx on public.integration_sync_log (entity, entity_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete restrict,
  actor_role public.app_role,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
comment on table public.audit_log is 'A permanent record of who viewed or changed what. Rows can be added but never edited or deleted.';
comment on column public.audit_log.actor_id is 'Empty for system actions.';
comment on column public.audit_log.action is 'viewed, created, updated, deleted, released and so on.';
comment on column public.audit_log.entity is 'Table name.';
comment on column public.audit_log.metadata is 'What changed: column names only, never clinical values, because this table can never be erased.';
create index audit_log_actor_id_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- RLS on every table in public, enabled and forced.
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end;
$$;
