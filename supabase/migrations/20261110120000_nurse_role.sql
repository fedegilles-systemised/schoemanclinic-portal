-- The clinic has a nurse. This only adds the value: Postgres cannot use a new enum value in the
-- same transaction that adds it, so everything that uses it is in the next migration.
alter type public.app_role add value if not exists 'nurse';
alter type public.staff_role add value if not exists 'nurse';
