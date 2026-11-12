-- A send that SignatureRx did not confirm stays 'sending' on purpose, so nobody sends it twice before
-- checking. Once someone has looked in SignatureRx, they can settle it here, in one of two ways:
--   * it was created there: record its SignatureRx id, so its state can be followed;
--   * it was not created: close it, with what they found, so it can be sent again.
-- An admin, or a doctor who may send for this patient, can do either, once the send is a few minutes
-- old (the first call may still be running before that). Both are audited.

create function private.close_signaturerx_send(_id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.signaturerx_prescriptions;
  reason text := btrim(coalesce(_reason, ''));
begin
  select * into s from public.signaturerx_prescriptions where id = _id for update;
  if not found or s.status <> 'sending' then
    raise exception 'That send is not waiting for a check.' using errcode = '22023';
  end if;
  if not (private.has_role('admin') or private.staff_may_send_prescription((select auth.uid()), s.patient_id)) then
    raise exception 'Only an admin, or a doctor on this patient''s care team, can close a send.' using errcode = '42501';
  end if;
  if s.sent_at > now() - interval '5 minutes' then
    -- The first call to SignatureRx may still be running; settling now could leave two prescriptions.
    raise exception 'This send is only minutes old. Wait a few minutes for SignatureRx to answer, then look for it there.' using errcode = '22023';
  end if;
  if char_length(reason) not between 1 and 200 then
    raise exception 'Say what you found in SignatureRx, in 200 characters or fewer.' using errcode = '22023';
  end if;
  update public.signaturerx_prescriptions
  set status = 'failed', last_error = 'Closed by hand after checking SignatureRx: ' || reason
  where id = _id;
end;
$$;

create function private.confirm_signaturerx_send(_id uuid, _srx_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.signaturerx_prescriptions;
  srx text := btrim(coalesce(_srx_id, ''));
begin
  select * into s from public.signaturerx_prescriptions where id = _id for update;
  if not found or s.status <> 'sending' then
    raise exception 'That send is not waiting for a check.' using errcode = '22023';
  end if;
  if not (private.has_role('admin') or private.staff_may_send_prescription((select auth.uid()), s.patient_id)) then
    raise exception 'Only an admin, or a doctor on this patient''s care team, can record a send.' using errcode = '42501';
  end if;
  if s.sent_at > now() - interval '5 minutes' then
    -- The first call to SignatureRx may still be running; settling now could leave two prescriptions.
    raise exception 'This send is only minutes old. Wait a few minutes for SignatureRx to answer, then look for it there.' using errcode = '22023';
  end if;
  if char_length(srx) not between 1 and 100 then
    raise exception 'Enter the SignatureRx prescription id.' using errcode = '22023';
  end if;
  begin
    -- The state is not known yet: the next check with SignatureRx fills it in.
    update public.signaturerx_prescriptions
    set srx_prescription_id = srx, status = null, detailed_status = null, last_checked_at = null
    where id = _id;
  exception when unique_violation then
    raise exception 'That SignatureRx id is already recorded for another request.' using errcode = '23505';
  end;
end;
$$;

create function public.close_signaturerx_send(_id uuid, _reason text)
returns void language sql security invoker set search_path = ''
as $$ select private.close_signaturerx_send(_id, _reason); $$;
create function public.confirm_signaturerx_send(_id uuid, _srx_id text)
returns void language sql security invoker set search_path = ''
as $$ select private.confirm_signaturerx_send(_id, _srx_id); $$;

revoke all on function
  private.close_signaturerx_send(uuid, text),
  private.confirm_signaturerx_send(uuid, text),
  public.close_signaturerx_send(uuid, text),
  public.confirm_signaturerx_send(uuid, text)
from public, anon, authenticated;

grant execute on function
  private.close_signaturerx_send(uuid, text),
  private.confirm_signaturerx_send(uuid, text),
  public.close_signaturerx_send(uuid, text),
  public.confirm_signaturerx_send(uuid, text)
to authenticated;
