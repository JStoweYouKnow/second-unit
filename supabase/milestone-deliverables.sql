-- Optional milestone deliverables + artist release requests.
-- Run after contract-milestones.sql and contract-attachments-storage.sql

alter table contract_milestones
  add column if not exists deliverable_note text,
  add column if not exists deliverable_url text,
  add column if not exists deliverable_storage_path text,
  add column if not exists deliverable_name text,
  add column if not exists deliverable_mime text,
  add column if not exists deliverable_submitted_at timestamptz,
  add column if not exists release_requested_at timestamptz,
  add column if not exists release_requested_by uuid references profiles(id);

comment on column contract_milestones.deliverable_note is 'Optional artist note / link description when submitting work for a milestone';
comment on column contract_milestones.release_requested_at is 'When the artist asked the hirer to approve & release escrow';

-- Private bucket for milestone work product (broader mime types than contract agreements).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'milestone-deliverables',
  'milestone-deliverables',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path format: {contract_id}/{milestone_id}/{filename}

create policy "Contract participants can read milestone deliverables"
on storage.objects for select
to authenticated
using (
  bucket_id = 'milestone-deliverables'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and (
        c.employer_id = auth.uid()
        or auth.uid() in (select profile_id from artists where id = c.artist_id)
      )
  )
);

create policy "Assigned artists can upload milestone deliverables"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'milestone-deliverables'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and auth.uid() in (select profile_id from artists where id = c.artist_id)
  )
);

create policy "Assigned artists can update milestone deliverables"
on storage.objects for update
to authenticated
using (
  bucket_id = 'milestone-deliverables'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and auth.uid() in (select profile_id from artists where id = c.artist_id)
  )
);

create policy "Assigned artists can delete milestone deliverables"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'milestone-deliverables'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and auth.uid() in (select profile_id from artists where id = c.artist_id)
  )
);
