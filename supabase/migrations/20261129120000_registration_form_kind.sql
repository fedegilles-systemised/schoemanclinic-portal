-- The registration form a new patient completes is kept on their record like every other form they submit.
-- The new value is added on its own so the next migration can use it.
alter type public.form_kind add value if not exists 'registration';
