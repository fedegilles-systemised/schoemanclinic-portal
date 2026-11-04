-- A doctor's signature for letters. It has its own private bucket, because the avatars
-- bucket is readable by anyone signed in, and a signature must stay hidden from patients.
-- Only the owner reads it here. Letters are made by server code, which reads it with the
-- service role. The path is exactly <user id>/signature: no other name is accepted.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 1048576, array['image/png', 'image/jpeg', 'image/webp']);

create policy "Doctors read their own signature" on storage.objects
  for select to authenticated
  using (bucket_id = 'signatures' and name = (select auth.uid())::text || '/signature');

create policy "Doctors upload their own signature" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and name = (select auth.uid())::text || '/signature'
    and (select private.has_role('doctor'))
  );

create policy "Doctors replace their own signature" on storage.objects
  for update to authenticated
  using (bucket_id = 'signatures' and name = (select auth.uid())::text || '/signature')
  with check (
    bucket_id = 'signatures'
    and name = (select auth.uid())::text || '/signature'
    and (select private.has_role('doctor'))
  );
-- No delete policy: files are not hard-deleted.
