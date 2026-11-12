-- Lint only: two uuid[] variables in private.request_repeat started from the text '{}', which Postgres
-- converts at run time but the database linter rightly flags. The behaviour does not change. The
-- function is replaced whole, because the migration that created it is already applied.

create or replace function private.request_repeat(
  _patient uuid,
  _items jsonb,
  _has_future_appointment boolean,
  _wants_appointment boolean,
  _still_losing_weight boolean,
  _weight_lost_last_month text,
  _has_side_effects boolean,
  _side_effects text,
  _note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  request uuid;
  item jsonb;
  medication uuid;
  medicine uuid;
  other text;
  months smallint;
  weight_loss boolean := false;
  seen_medications uuid[] := array[]::uuid[];
  seen_medicines uuid[] := array[]::uuid[];
begin
  if actor is null or not (
    private.can_act_for(_patient)
    or (private.has_role('pa') and private.in_scope(_patient))
  ) then
    raise exception 'You cannot request a repeat for this patient.' using errcode = '42501';
  end if;
  if _has_future_appointment is null then
    raise exception 'Say whether a future appointment is booked.' using errcode = '22023';
  end if;
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) not between 1 and 10 then
    raise exception 'Choose between one and ten medicines.' using errcode = '22023';
  end if;
  if char_length(_note) > 2000 or char_length(_weight_lost_last_month) > 200 or char_length(_side_effects) > 2000 then
    raise exception 'One of the answers is too long.' using errcode = '22023';
  end if;

  -- Check every medicine before writing anything.
  for item in select * from jsonb_array_elements(_items) loop
    medication := private.try_uuid(item ->> 'medication_id');
    medicine := private.try_uuid(item ->> 'medicine_id');
    other := nullif(btrim(item ->> 'other_name'), '');
    months := case when item ->> 'supply_months' in ('1', '2') then (item ->> 'supply_months')::smallint end;
    if months is null then
      raise exception 'Choose one or two months for each medicine.' using errcode = '22023';
    end if;
    if num_nonnulls(medication, medicine, other) <> 1 then
      raise exception 'Each line must name one medicine.' using errcode = '22023';
    end if;
    if medication is not null then
      if medication = any (seen_medications) or not exists (
        select 1 from public.medications m
        where m.id = medication and m.patient_id = _patient and m.status = 'active' and m.archived_at is null
      ) then
        raise exception 'One of the medicines is not on the current list.' using errcode = '22023';
      end if;
      seen_medications := seen_medications || medication;
      weight_loss := weight_loss or private.is_weight_loss_name((select m.name from public.medications m where m.id = medication));
    elsif medicine is not null then
      if medicine = any (seen_medicines) or not exists (
        select 1 from public.prescribable_medicines p where p.id = medicine and p.archived_at is null
      ) then
        raise exception 'One of the medicines is not on the clinic''s list.' using errcode = '22023';
      end if;
      seen_medicines := seen_medicines || medicine;
      weight_loss := weight_loss or (select p.weight_loss from public.prescribable_medicines p where p.id = medicine);
    else
      if char_length(other) > 200 then
        raise exception 'Use 200 characters or fewer for a medicine name.' using errcode = '22023';
      end if;
      weight_loss := weight_loss or private.is_weight_loss_name(other);
    end if;
  end loop;

  if weight_loss and (_still_losing_weight is null or _has_side_effects is null) then
    raise exception 'Answer the weight-loss questions.' using errcode = '22023';
  end if;
  if weight_loss and _has_side_effects and nullif(btrim(_side_effects), '') is null then
    raise exception 'Describe the side effects.' using errcode = '22023';
  end if;

  insert into public.repeat_requests (
    patient_id, requested_by, note, has_future_appointment, wants_appointment,
    still_losing_weight, weight_lost_last_month, has_side_effects, side_effects
  ) values (
    _patient, actor, nullif(btrim(_note), ''), _has_future_appointment,
    case when _has_future_appointment then null else _wants_appointment end,
    case when weight_loss then _still_losing_weight end,
    case when weight_loss and _still_losing_weight then nullif(btrim(_weight_lost_last_month), '') end,
    case when weight_loss then _has_side_effects end,
    case when weight_loss and _has_side_effects then btrim(_side_effects) end
  )
  returning id into request;

  insert into public.repeat_request_items (request_id, patient_id, medication_id, medicine_id, other_name, supply_months)
  select request, _patient,
    private.try_uuid(i ->> 'medication_id'),
    private.try_uuid(i ->> 'medicine_id'),
    nullif(btrim(i ->> 'other_name'), ''),
    (i ->> 'supply_months')::smallint
  from jsonb_array_elements(_items) i;

  return request;
end;
$$;
