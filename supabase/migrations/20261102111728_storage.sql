-- Private storage buckets. The app serves files through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

-- documents: object paths start with the patient id. A file is readable only by someone
-- who can read its documents row, under that person's own row-level security.
create policy "People read a document file when they can read its row" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (select 1 from public.documents d where d.storage_path = name)
  );

create policy "People upload document files for patients they can act for" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      private.can_act_for(private.try_uuid(split_part(name, '/', 1)))
      or (
        ((select private.has_role('doctor')) or (select private.has_role('pa')))
        and (
          split_part(name, '/', 1) = 'unmatched'
          or private.in_scope(private.try_uuid(split_part(name, '/', 1)))
        )
      )
    )
  );

-- avatars: object paths start with the user id. Anyone signed in may see staff photos,
-- as in the staff directory. Patient photos go to that patient and the team only.
create policy "People read their own avatar, staff avatars, and the team reads all" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      split_part(name, '/', 1) = (select auth.uid())::text
      or private.is_active_staff(private.try_uuid(split_part(name, '/', 1)))
      or (select private.is_team())
    )
  );

create policy "People upload their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "People replace their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

-- No delete policy on either bucket: files are not hard-deleted.
