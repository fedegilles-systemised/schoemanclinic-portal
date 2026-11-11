-- A nurse can be on a patient's care team. Only the value is added here: Postgres cannot use a new
-- enum value in the transaction that adds it, so the access rules that use it are in the next migration.
alter type public.care_relationship add value if not exists 'nurse';
