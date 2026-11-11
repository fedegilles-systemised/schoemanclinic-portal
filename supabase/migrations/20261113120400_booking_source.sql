-- Appointments can now be booked in Clinic Hub itself (knowledge base question 15). Only the enum
-- value is added here: Postgres cannot use a new value in the transaction that adds it.
alter type public.appt_source add value if not exists 'clinic_hub';
