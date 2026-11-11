-- A nurse can be on a patient's care team. Only the value is added here: Postgres cannot use a new
-- enum value in the transaction that adds it, so the access rules that use it are in the next migration.
alter type public.care_relationship add value if not exists 'nurse';

-- New care-team rows start on the clinic's day, not the database's UTC day.
alter table public.care_team alter column since set default (now() at time zone 'Europe/London')::date;
