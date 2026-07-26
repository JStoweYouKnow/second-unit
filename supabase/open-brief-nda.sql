-- Optional NDA / MNDA attachment for open briefs.
-- Run after open-briefs.sql

alter table open_briefs
  add column if not exists nda_storage_path text,
  add column if not exists nda_name text,
  add column if not exists nda_mime text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brief-nda',
  'brief-nda',
  false,
  15728640,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path format: {brief_id}/{filename}

create policy "Brief NDA readable by employer applicants and open browse"
on storage.objects for select
to authenticated
using (
  bucket_id = 'brief-nda'
  and exists (
    select 1 from open_briefs b
    where b.id::text = (storage.foldername(name))[1]
      and (
        b.employer_id = auth.uid()
        or b.status = 'open'
        or auth.uid() in (
          select ar.profile_id
          from artists ar
          join brief_applications ba on ba.artist_id = ar.id
          where ba.brief_id = b.id
        )
      )
  )
);

create policy "Employers upload brief NDA"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'brief-nda'
  and exists (
    select 1 from open_briefs b
    where b.id::text = (storage.foldername(name))[1]
      and b.employer_id = auth.uid()
  )
);

create policy "Employers update brief NDA"
on storage.objects for update
to authenticated
using (
  bucket_id = 'brief-nda'
  and exists (
    select 1 from open_briefs b
    where b.id::text = (storage.foldername(name))[1]
      and b.employer_id = auth.uid()
  )
);

create policy "Employers delete brief NDA"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'brief-nda'
  and exists (
    select 1 from open_briefs b
    where b.id::text = (storage.foldername(name))[1]
      and b.employer_id = auth.uid()
  )
);
