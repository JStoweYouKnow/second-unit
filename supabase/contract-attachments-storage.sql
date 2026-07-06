-- Private bucket for custom contract PDFs / Word docs.
-- Run after product-gaps-migration.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contract-attachments',
  'contract-attachments',
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

-- Path format: {contract_id}/{filename}

create policy "Contract participants can read attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'contract-attachments'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and (
        c.employer_id = auth.uid()
        or auth.uid() in (select profile_id from artists where id = c.artist_id)
      )
  )
);

create policy "Employers can upload contract attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'contract-attachments'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and c.employer_id = auth.uid()
  )
);

create policy "Employers can update own contract attachments"
on storage.objects for update
to authenticated
using (
  bucket_id = 'contract-attachments'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and c.employer_id = auth.uid()
  )
);

create policy "Employers can delete own contract attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'contract-attachments'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and c.employer_id = auth.uid()
  )
);

-- Store storage object path (not ephemeral blob URLs)
alter table contracts
  add column if not exists attachment_storage_path text;
