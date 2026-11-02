-- Fixed lists from the schema draft.

create type public.app_role as enum ('patient', 'doctor', 'pa', 'health_coach', 'admin');
create type public.account_status as enum ('invited', 'active', 'suspended');
create type public.staff_role as enum ('doctor', 'pa', 'health_coach', 'admin');
create type public.diagnosis_status as enum ('active', 'monitoring', 'treating', 'under_investigation', 'resolved');
create type public.med_kind as enum ('prescription', 'supplement');
create type public.med_status as enum ('active', 'paused', 'stopped');
create type public.request_status as enum ('requested', 'approved', 'sent_to_pharmacy', 'declined');
create type public.appt_status as enum ('booked', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.doc_kind as enum ('letter', 'lab_report', 'patient_upload', 'referral', 'other');
create type public.question_status as enum ('awaiting_reply', 'answered', 'closed');
create type public.order_status as enum ('sent_to_patient', 'paid', 'sample_taken', 'results_in', 'reviewed', 'cancelled');
create type public.report_status as enum ('awaiting_review', 'reviewed', 'released');
create type public.result_flag as enum ('normal', 'borderline', 'low', 'high', 'critical');
create type public.import_status as enum ('needs_match', 'matched', 'confirmed', 'rejected');

-- Other values the draft lists as fixed.
create type public.notification_topic as enum ('results', 'payments', 'appointments', 'messages');
create type public.notification_channel as enum ('email', 'whatsapp', 'sms', 'portal');
create type public.location_kind as enum ('clinic', 'video');
create type public.care_relationship as enum ('primary_doctor', 'doctor', 'pa', 'health_coach');
create type public.guardian_relationship as enum ('parent', 'carer', 'power_of_attorney');
create type public.consent_type as enum ('care', 'partner_labs', 'research');
create type public.safeguarding_severity as enum ('low', 'moderate', 'high');
create type public.appt_source as enum ('ghl', 'semble');
create type public.document_source as enum ('patient_upload', 'email', 'tdl', 'semble');
create type public.question_urgency as enum ('routine', 'important');
create type public.results_channel as enum ('api', 'email', 'upload');
create type public.import_confidence as enum ('high', 'medium', 'low');
create type public.import_decision as enum ('pending', 'confirmed', 'rejected');
create type public.webhook_source as enum ('stripe', 'tdl', 'ghl', 'semble', 'fathom');
create type public.webhook_status as enum ('received', 'processed', 'failed', 'ignored');
create type public.sync_system as enum ('ghl', 'semble', 'stripe', 'tdl', 'fathom');
create type public.sync_direction as enum ('in', 'out');
create type public.sync_status as enum ('ok', 'failed', 'retrying');
