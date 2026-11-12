-- Two audit trails asked for by the clinic's CQC governance adviser (Dr Schoeman, 12 November 2026).
--
-- 1. Results sign-off. When a doctor releases a lab report they now sign it off: "action", with the
--    action taken or planned, or "no action". The sign-off records who ordered the tests and who
--    signed off, so a report signed by a doctor other than the one who ordered it shows as such.
--    Another doctor may sign off (the ordering doctor may be away); it is recorded, not blocked.
--    External reports with no order (GutMap, Nordic, Regenerus and other PDFs) are signed off the
--    same way. Sign-offs are for the team only: patients never read the action note. Nothing edits
--    or removes a sign-off.
-- 2. Treatment options in clinical notes. A note records that all available treatment options were
--    discussed, including customised options and NICE guideline options, and that side effects
--    were discussed, with an optional list of the options offered. Like the rest of the note, they
--    are fixed once it is signed.

-- 1. Results sign-off -------------------------------------------------------------------------------

create table public.lab_report_signoffs (
  report_id uuid primary key,
  -- The same value as report_id, so the audit log (which records a row's id) names the report.
  id uuid not null unique check (id = report_id),
  patient_id uuid not null references public.patient_profiles (id) on delete restrict,
  outcome text not null check (outcome in ('action', 'no_action')),
  action_note text check (char_length(btrim(action_note)) between 1 and 2000),
  signed_by uuid not null references public.staff_profiles (id) on delete restrict,
  ordered_by uuid references public.staff_profiles (id) on delete restrict,
  signed_at timestamptz not null default now(),
  constraint lab_report_signoffs_report_fkey foreign key (report_id, patient_id)
    references public.lab_reports (id, patient_id) on delete restrict,
  constraint lab_report_signoffs_action_note check ((outcome = 'action') = (action_note is not null))
);
comment on table public.lab_report_signoffs is 'A doctor''s sign-off of a lab report, made when it is released: action (with the action) or no action. For the team only; never changed.';
comment on column public.lab_report_signoffs.ordered_by is 'Who ordered the tests, copied from the order when signed. Empty for external results with no order.';
create index lab_report_signoffs_patient_idx on public.lab_report_signoffs (patient_id, signed_at desc);
create index lab_report_signoffs_report_patient_idx on public.lab_report_signoffs (report_id, patient_id);
create index lab_report_signoffs_signed_by_idx on public.lab_report_signoffs (signed_by);
create index lab_report_signoffs_ordered_by_idx on public.lab_report_signoffs (ordered_by);

create trigger lab_report_signoffs_write_audit_log after insert or update or delete on public.lab_report_signoffs
  for each row execute function private.write_audit_log();

-- Sign-offs are written only by release_report and never changed, for any role.
create function private.reject_signoff_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A sign-off is permanent and cannot be changed or removed.' using errcode = '42501';
end;
$$;
create trigger lab_report_signoffs_permanent before update or delete on public.lab_report_signoffs
  for each row execute function private.reject_signoff_change();
-- Emptying the table would skip the row triggers above, so it is refused too.
create trigger lab_report_signoffs_no_truncate before truncate on public.lab_report_signoffs
  for each statement execute function private.reject_signoff_change();

alter table public.lab_report_signoffs enable row level security;
alter table public.lab_report_signoffs force row level security;
revoke all on table public.lab_report_signoffs from public, anon, authenticated;
-- Not even server code may write one: only release_report (as the table owner) does.
revoke insert, update, delete, truncate, references, trigger on public.lab_report_signoffs from service_role;
grant select on public.lab_report_signoffs to authenticated;

create policy "Staff who can open the record read sign-offs" on public.lab_report_signoffs
  for select to authenticated
  using (private.in_scope(patient_id));

-- Releasing now needs a sign-off. The old two-argument version is replaced.
drop function public.release_report(uuid, text);
drop function private.release_report(uuid, text);

create function private.release_report(_report uuid, _comment text default null, _outcome text default null, _action_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff uuid := private.my_staff_id();
  r public.lab_reports;
  patient_user uuid;
  orderer uuid;
begin
  select * into r from public.lab_reports x where x.id = _report for update;
  if not found or staff is null or not (select private.has_role('doctor')) or not private.in_scope(r.patient_id) then
    raise exception 'You cannot release this report.' using errcode = '42501';
  end if;
  if r.released_at is not null then
    raise exception 'This report has already been released.' using errcode = '23505';
  end if;
  if _comment is not null and char_length(_comment) > 2000 then
    raise exception 'Use 2,000 characters or fewer for the comment.' using errcode = '22023';
  end if;
  if _outcome is null or _outcome not in ('action', 'no_action') then
    raise exception 'Sign the report off: action or no action.' using errcode = '22023';
  end if;
  if _outcome = 'action' and (nullif(btrim(_action_note), '') is null or char_length(btrim(_action_note)) > 2000) then
    raise exception 'Describe the action, in up to 2,000 characters.' using errcode = '22023';
  end if;

  if r.lab_order_id is not null then
    select o.ordered_by into orderer from public.lab_orders o where o.id = r.lab_order_id;
  end if;

  update public.lab_reports
  set status = 'released', reviewed_by = staff, reviewed_at = now(), released_at = now(),
      patient_comment = nullif(btrim(_comment), '')
  where id = _report;

  insert into public.lab_report_signoffs (report_id, id, patient_id, outcome, action_note, signed_by, ordered_by)
  values (_report, _report, r.patient_id, _outcome, case when _outcome = 'action' then btrim(_action_note) end, staff, orderer);

  if r.lab_order_id is not null then
    update public.lab_orders set status = 'reviewed' where id = r.lab_order_id and status = 'results_in';
  end if;

  select p.user_id into patient_user from public.patient_profiles p where p.id = r.patient_id;
  if patient_user is not null then
    insert into public.notifications (user_id, topic, title, body, link)
    values (patient_user, 'results', 'Your results are ready', 'A doctor has reviewed them and added them to your account.', '/portal/results');
  end if;
end;
$$;
comment on function private.release_report(uuid, text, text, text) is 'A doctor in scope releases a lab report and signs it off (action with the action, or no action).';

create function public.release_report(_report uuid, _comment text default null, _outcome text default null, _action_note text default null)
returns void language sql security invoker set search_path = ''
as $$ select private.release_report(_report, _comment, _outcome, _action_note); $$;

revoke all on function private.release_report(uuid, text, text, text), public.release_report(uuid, text, text, text) from public, anon, authenticated;
grant execute on function private.release_report(uuid, text, text, text), public.release_report(uuid, text, text, text) to authenticated;

-- 2. Treatment options in clinical notes --------------------------------------------------------------

alter table public.clinical_notes
  add column all_options_discussed boolean not null default false,
  add column customised_options_discussed boolean not null default false,
  add column nice_options_discussed boolean not null default false,
  add column side_effects_discussed boolean not null default false,
  add column options_offered text check (char_length(options_offered) <= 5000);
comment on column public.clinical_notes.all_options_discussed is 'The author confirms all available treatment options were discussed. Fixed once signed.';
comment on column public.clinical_notes.customised_options_discussed is 'Customised (non-guideline) options were discussed.';
comment on column public.clinical_notes.nice_options_discussed is 'NICE guideline options were discussed.';
comment on column public.clinical_notes.side_effects_discussed is 'Side effects were discussed.';
comment on column public.clinical_notes.options_offered is 'Optional: the options offered, in the author''s words.';

grant insert (all_options_discussed, customised_options_discussed, nice_options_discussed, side_effects_discussed, options_offered)
  on public.clinical_notes to authenticated;
grant update (all_options_discussed, customised_options_discussed, nice_options_discussed, side_effects_discussed, options_offered)
  on public.clinical_notes to authenticated;
