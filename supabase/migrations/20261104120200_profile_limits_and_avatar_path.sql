-- S-71: a name and a phone number have limits in the database, not only in the app.
alter table public.profiles
  add constraint profiles_full_name_length check (char_length(full_name) <= 120);
alter table public.profiles
  add constraint profiles_phone_format check (phone is null or (char_length(phone) <= 30 and phone ~ '^[0-9+()\-\s]*$'));

-- S-70: a photo lives at exactly <user id>/avatar, as a signature does. Any other name in the
-- folder is refused, so the bucket cannot hold arbitrary files under an image type.
alter policy "People upload their own avatar" on storage.objects
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

alter policy "People replace their own avatar" on storage.objects
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
