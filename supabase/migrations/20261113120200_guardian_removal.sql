-- Removing a guardian (knowledge base question 5, decided 11 November 2026): a patient cannot remove
-- a guardian; a PA or an admin does. Nothing is deleted: removal switches off can_view and can_act,
-- which ends the guardian's access at once, and the audit log keeps who did it and when.

alter policy "PAs change guardian links" on public.patient_guardians
  using (
    ((select private.has_role('pa')) or (select private.has_role('admin')))
    and private.in_scope(patient_id)
    and guardian_user_id <> (select auth.uid())
  )
  with check (
    ((select private.has_role('pa')) or (select private.has_role('admin')))
    and private.in_scope(patient_id)
    and guardian_user_id <> (select auth.uid())
    -- Verifying a link records who verified it. Removing one may be done by any PA or admin.
    and (verified_by is null or verified_by = (select private.my_staff_id()) or (not can_view and not can_act))
  );
