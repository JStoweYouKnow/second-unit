-- Hosted portfolio media (images + short video) in Supabase Storage.
-- Run after schema.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-media',
  'portfolio-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {artist_id}/{timestamp}-{filename}

create policy "Portfolio media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'portfolio-media');

create policy "Artists upload own portfolio media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolio-media'
    and (storage.foldername(name))[1]::uuid in (
      select id from artists where profile_id = auth.uid()
    )
  );

create policy "Artists delete own portfolio media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portfolio-media'
    and (storage.foldername(name))[1]::uuid in (
      select id from artists where profile_id = auth.uid()
    )
  );

alter table portfolio_items
  add column if not exists storage_path text;
