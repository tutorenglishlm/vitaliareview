-- VITALIA Review Cards — Storage bucket for logos
-- Run this in the Supabase Dashboard → SQL Editor → New query → Run.

-- 1) Public bucket for logo images
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- 2) Policies on storage.objects
drop policy if exists logos_read_public on storage.objects;
drop policy if exists logos_insert_own  on storage.objects;
drop policy if exists logos_update_own  on storage.objects;
drop policy if exists logos_delete_own  on storage.objects;

-- anyone can view a logo (they end up on printed cards anyway)
create policy logos_read_public on storage.objects
  for select using (bucket_id = 'logos');

-- only the signed-in owner can write to their own folder (<user_id>/…)
create policy logos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy logos_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy logos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
