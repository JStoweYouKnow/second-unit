-- Confidentiality features: project references, message attachments, NDA acceptance,
-- brief visibility tiers, and stricter storage policies.
-- Run after open-brief-nda.sql

-- ---------------------------------------------------------------------------
-- Open brief visibility + NDA acceptance
-- ---------------------------------------------------------------------------
alter table open_briefs
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'nda_gated', 'invite_only'));

comment on column open_briefs.visibility is
  'public: full listing; nda_gated: summary until NDA accepted; invite_only: hidden from browse except applicants';

alter table brief_applications
  add column if not exists nda_accepted_at timestamptz;

comment on column brief_applications.nda_accepted_at is
  'When the artist acknowledged the brief NDA before applying';

create table if not exists brief_nda_acceptances (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid not null references open_briefs(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  unique (brief_id, artist_id)
);

create index if not exists idx_brief_nda_acceptances_brief on brief_nda_acceptances(brief_id);
create index if not exists idx_brief_nda_acceptances_artist on brief_nda_acceptances(artist_id);

alter table brief_nda_acceptances enable row level security;

create policy "Artists record own brief NDA acceptance"
  on brief_nda_acceptances for insert
  to authenticated
  with check (
    auth.uid() in (select profile_id from artists where id = artist_id)
  );

create policy "Participants read brief NDA acceptances"
  on brief_nda_acceptances for select
  to authenticated
  using (
    auth.uid() in (select profile_id from artists where id = artist_id)
    or auth.uid() in (select employer_id from open_briefs where id = brief_id)
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Replace open-brief browse policy for invite-only briefs
drop policy if exists "Browse open briefs" on open_briefs;

create policy "Browse open briefs"
  on open_briefs for select
  to authenticated
  using (
    employer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      status = 'open'
      and visibility in ('public', 'nda_gated')
    )
    or (
      visibility = 'invite_only'
      and auth.uid() in (
        select ar.profile_id
        from artists ar
        join brief_applications ba on ba.artist_id = ar.id
        where ba.brief_id = open_briefs.id
      )
    )
    or (
      status = 'open'
      and visibility = 'invite_only'
    )
    or auth.uid() in (
      select ar.profile_id
      from artists ar
      join brief_applications ba on ba.artist_id = ar.id
      where ba.brief_id = open_briefs.id
    )
  );

-- ---------------------------------------------------------------------------
-- Project reference vault (hirer uploads; artist reads after both signed)
-- ---------------------------------------------------------------------------
create table if not exists project_references (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references contracts(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  name text not null,
  mime text,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_references_contract on project_references(contract_id, created_at desc);

alter table project_references enable row level security;

create policy "Contract participants read project references"
  on project_references for select
  to authenticated
  using (
    auth.uid() in (
      select c.employer_id from contracts c where c.id = contract_id
    )
    or (
      auth.uid() in (
        select ar.profile_id
        from contracts c
        join artists ar on ar.id = c.artist_id
        where c.id = contract_id
      )
      and exists (
        select 1 from contracts c
        where c.id = contract_id
          and c.signed_by_employer = true
          and c.signed_by_artist = true
      )
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Employers insert project references"
  on project_references for insert
  to authenticated
  with check (
    auth.uid() in (
      select c.employer_id from contracts c where c.id = contract_id
    )
  );

create policy "Employers delete own project references"
  on project_references for delete
  to authenticated
  using (
    auth.uid() in (
      select c.employer_id from contracts c where c.id = contract_id
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-references',
  'project-references',
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
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {contract_id}/{timestamp}-{filename}

create policy "Employers upload project references"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-references'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and c.employer_id = auth.uid()
  )
);

create policy "Employers delete project reference files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-references'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and c.employer_id = auth.uid()
  )
);

create policy "Project reference files readable by contract parties when signed"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-references'
  and exists (
    select 1 from contracts c
    where c.id::text = (storage.foldername(name))[1]
      and (
        c.employer_id = auth.uid()
        or (
          c.signed_by_employer = true
          and c.signed_by_artist = true
          and auth.uid() in (select profile_id from artists where id = c.artist_id)
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- Message attachments (requires signed contract between parties)
-- ---------------------------------------------------------------------------
alter table messages
  add column if not exists attachment_storage_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  26214400,
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
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {conversation_id}/{timestamp}-{filename}

create policy "Conversation participants upload message attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and exists (
    select 1 from conversations cv
    where cv.id::text = (storage.foldername(name))[1]
      and (
        cv.employer_id = auth.uid()
        or auth.uid() in (select profile_id from artists where id = cv.artist_id)
      )
      and exists (
        select 1 from contracts c
        where c.employer_id = cv.employer_id
          and c.artist_id = cv.artist_id
          and c.signed_by_employer = true
          and c.signed_by_artist = true
      )
  )
);

create policy "Conversation participants read message attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'message-attachments'
  and exists (
    select 1 from conversations cv
    where cv.id::text = (storage.foldername(name))[1]
      and (
        cv.employer_id = auth.uid()
        or auth.uid() in (select profile_id from artists where id = cv.artist_id)
      )
  )
);

-- Tighten brief NDA reads: employer, applicants, or NDA acceptors on nda_gated briefs
drop policy if exists "Brief NDA readable by employer applicants and open browse" on storage.objects;

create policy "Brief NDA readable by authorized parties"
on storage.objects for select
to authenticated
using (
  bucket_id = 'brief-nda'
  and exists (
    select 1 from open_briefs b
    where b.id::text = (storage.foldername(name))[1]
      and (
        b.employer_id = auth.uid()
        or auth.uid() in (
          select ar.profile_id
          from artists ar
          join brief_applications ba on ba.artist_id = ar.id
          where ba.brief_id = b.id
        )
        or auth.uid() in (
          select ar.profile_id
          from artists ar
          join brief_nda_acceptances na on na.artist_id = ar.id
          where na.brief_id = b.id
        )
        or (b.visibility = 'public' and b.status = 'open')
        or (b.visibility = 'nda_gated' and b.status = 'open')
      )
  )
);
