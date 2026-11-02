-- Audit triggers. Inserts, updates and deletes on the clinical tables write to audit_log.

create function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  actor uuid;
  role_held public.app_role;
  changed text[];
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  -- Server code has no auth.uid(), so it names the person it acts for:
  -- set_config('app.actor_id', <profile id>, true) in the same transaction.
  select p.id into actor
  from public.profiles p
  where p.id = coalesce((select auth.uid()), private.try_uuid(current_setting('app.actor_id', true)));

  if actor is not null then
    -- A person can hold more than one role; a staff role says more than patient.
    select r.role into role_held
    from public.user_roles r
    where r.user_id = actor
    order by (r.role = 'patient'), r.role
    limit 1;
  end if;

  -- Column names only: this table can never be erased, so it holds no clinical values.
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into changed
    from jsonb_each(row_data) n
    where n.value is distinct from (to_jsonb(old) -> n.key);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity, entity_id, metadata)
  values (
    actor,
    role_held,
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    tg_table_name,
    private.try_uuid(coalesce(row_data ->> 'id', row_data ->> 'user_id', row_data ->> 'staff_id', row_data ->> 'panel_id')),
    case when changed is null then null else jsonb_build_object('changed', changed) end
  );
  return null;
end;
$$;
comment on function private.write_audit_log() is 'Trigger: records who changed which clinical row, and which columns.';

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_roles', 'invitations', 'staff_profiles', 'staff_locations', 'care_team',
    'locations', 'markers', 'lab_partners', 'lab_panels', 'lab_panel_markers',
    'patient_profiles', 'patient_guardians', 'patient_allergies', 'consents', 'diagnoses',
    'safeguarding_alerts', 'medications', 'repeat_requests', 'appointments', 'documents',
    'questions', 'lab_orders', 'lab_reports', 'result_imports', 'results', 'import_items'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.write_audit_log()',
      t || '_write_audit_log', t
    );
  end loop;
end;
$$;

-- Even the service role cannot rewrite history.
create function private.reject_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only.' using errcode = '42501';
end;
$$;
comment on function private.reject_audit_change() is 'Trigger: audit_log rows can never be updated, deleted or truncated.';

create trigger audit_log_reject_update_delete before update or delete on public.audit_log
  for each row execute function private.reject_audit_change();
create trigger audit_log_reject_truncate before truncate on public.audit_log
  for each statement execute function private.reject_audit_change();
