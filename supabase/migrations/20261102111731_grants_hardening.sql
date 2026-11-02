-- Grants hardening. Everything is revoked, then each command a policy allows is granted.
-- anon gets nothing: there are no public pages. No DELETE on any clinical table.

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on schema public from anon;
grant usage on schema public to authenticated, service_role;
grant usage on schema private to authenticated;

-- Helpers called from policies, and the definer half of the read functions.
grant execute on function
  private.is_active_staff(uuid),
  private.has_role(public.app_role),
  private.is_clinical_staff(),
  private.is_team(),
  private.my_patient_ids(),
  private.is_own_patient(uuid),
  private.can_act_for(uuid),
  private.in_scope(uuid),
  private.my_staff_id(),
  private.report_is_released(uuid),
  private.document_gate_open(uuid, public.doc_kind),
  private.storage_object_is_mine(text),
  private.try_uuid(text),
  private.get_my_patient_record(),
  private.get_staff_directory()
to authenticated;

grant execute on function public.get_my_patient_record(), public.get_staff_directory() to authenticated;

-- Identity and accounts
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_path, locale, last_seen_at, status) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
-- Invitations are created by server code; token_hash is never readable.
grant select (id, email, role, patient_id, invited_by, expires_at, accepted_at, created_at) on public.invitations to authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id, topic, channel, enabled) on public.notification_preferences to authenticated;
grant update (enabled) on public.notification_preferences to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Team and sites
grant select, insert, update on public.locations to authenticated;
grant select on public.staff_profiles to authenticated;
grant insert (user_id, job_title, clinical_role, gmc_number, signature_path, active) on public.staff_profiles to authenticated;
grant update (job_title, clinical_role, gmc_number, signature_path, active, archived_at) on public.staff_profiles to authenticated;
grant select, insert, update, delete on public.staff_locations to authenticated;
grant select on public.care_team to authenticated;
grant insert (patient_id, staff_id, relationship, since, until) on public.care_team to authenticated;
grant update (relationship, since, until) on public.care_team to authenticated;

-- Patient record
grant select on public.patient_profiles to authenticated;
grant insert (clinic_ref, first_name, last_name, date_of_birth, sex, contact_email, contact_phone, country, primary_clinician_id) on public.patient_profiles to authenticated;
grant update (first_name, last_name, date_of_birth, sex, contact_email, contact_phone, country, primary_clinician_id, archived_at) on public.patient_profiles to authenticated;
grant select on public.patient_guardians to authenticated;
grant insert (patient_id, guardian_user_id, relationship, can_view, can_act, verified_by) on public.patient_guardians to authenticated;
grant update (relationship, can_view, can_act, verified_by) on public.patient_guardians to authenticated;
grant select on public.patient_allergies to authenticated;
grant insert (patient_id, substance, reaction, severity, recorded_by) on public.patient_allergies to authenticated;
grant update (substance, reaction, severity) on public.patient_allergies to authenticated;
grant select on public.consents to authenticated;
grant insert (patient_id, consent_type, version, granted) on public.consents to authenticated;
grant select on public.diagnoses to authenticated;
grant insert (patient_id, icd10_code, label, status, diagnosed_on, recorded_by, notes) on public.diagnoses to authenticated;
grant update (icd10_code, label, status, diagnosed_on, notes, archived_at) on public.diagnoses to authenticated;
grant select on public.safeguarding_alerts to authenticated;
grant insert (patient_id, alert_type, severity, note, added_by, review_due, status) on public.safeguarding_alerts to authenticated;
grant update (alert_type, severity, note, review_due, status) on public.safeguarding_alerts to authenticated;
grant select on public.medications to authenticated;
grant insert (patient_id, name, dose, instructions, kind, prescriber_id, pharmacy, start_date, supply_days, status) on public.medications to authenticated;
grant update (name, dose, instructions, kind, pharmacy, start_date, supply_days, status, archived_at) on public.medications to authenticated;

-- Care and requests
grant select on public.repeat_requests to authenticated;
grant insert (medication_id, patient_id, requested_by, note) on public.repeat_requests to authenticated;
grant update (status, resolved_at) on public.repeat_requests to authenticated;
grant select on public.appointments to authenticated;
grant select on public.documents to authenticated;
grant insert (patient_id, kind, title, storage_path, source, uploaded_by, shared_with_patient, shared_at) on public.documents to authenticated;
grant update (title, shared_with_patient, shared_at, archived_at) on public.documents to authenticated;
grant select on public.questions to authenticated;
grant insert (patient_id, asked_by, subject, body, urgency) on public.questions to authenticated;
grant update (status, answered_at) on public.questions to authenticated;

-- Labs and results
grant select on public.lab_orders to authenticated;
grant insert (order_ref, patient_id, panel_id, lab_partner_id, ordered_by, appointment_id, due_by, price_pence) on public.lab_orders to authenticated;
grant update (panel_id, lab_partner_id, appointment_id, due_by, price_pence, status, sample_taken_at) on public.lab_orders to authenticated;
grant select on public.lab_reports to authenticated;
grant select on public.result_imports to authenticated;
grant update (patient_id, status, handled_by) on public.result_imports to authenticated;
grant select on public.results to authenticated;
grant update (doctor_comment) on public.results to authenticated;
grant select on public.import_items to authenticated;
grant update (marker_id, decision, decided_by) on public.import_items to authenticated;
grant select, insert, update on public.markers to authenticated;
grant select, insert, update on public.lab_partners to authenticated;
grant select, insert, update on public.lab_panels to authenticated;
grant select, insert, delete on public.lab_panel_markers to authenticated;

-- webhook_events, integration_sync_log and audit_log: nothing for authenticated.

-- The service role keeps what server code needs, but clinical records are never
-- hard-deleted, whoever asks.
revoke delete, truncate on
  public.profiles, public.user_roles, public.staff_profiles, public.care_team,
  public.patient_profiles, public.patient_guardians, public.patient_allergies, public.consents,
  public.diagnoses, public.safeguarding_alerts, public.medications, public.repeat_requests,
  public.appointments, public.documents, public.questions, public.lab_orders, public.lab_reports,
  public.result_imports, public.results, public.import_items, public.webhook_events,
  public.integration_sync_log
from service_role;

-- Nobody can rewrite the audit log. The trigger stops any role a grant could miss.
revoke update, delete, truncate on public.audit_log from public, anon, authenticated, service_role, postgres;
