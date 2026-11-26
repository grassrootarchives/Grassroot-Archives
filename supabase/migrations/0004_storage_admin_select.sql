-- Storage uploads (upsert) read the object back, so admins also need a select policy.
create policy storage_admin_select on storage.objects for select to authenticated
  using (bucket_id in ('maps', 'media') and private.is_admin());
