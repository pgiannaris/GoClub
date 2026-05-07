-- Site image uploads for the website editor.
-- Content stays in projects.content JSONB; uploads live in Supabase Storage.

insert into storage.buckets (id, name, public)
values ('site_images', 'site_images', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "Public can read site images" on storage.objects;
create policy "Public can read site images"
on storage.objects
for select
using (bucket_id = 'site_images');

drop policy if exists "Authenticated users can upload site images" on storage.objects;
create policy "Authenticated users can upload site images"
on storage.objects
for insert
with check (bucket_id = 'site_images' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete site images" on storage.objects;
create policy "Authenticated users can delete site images"
on storage.objects
for delete
using (bucket_id = 'site_images' and auth.role() = 'authenticated');