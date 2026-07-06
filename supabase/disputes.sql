-- Dispute resolution: mediation workflow with evidence and admin arbitration.
-- Run after contract-milestones.sql and booking-contract-link.sql

create type dispute_status as enum (
  'open',
  'under_review',
  'mediation',
  'resolved',
  'closed'
);

create type dispute_outcome as enum (
  'pending',
  'refund_employer',
  'release_artist',
  'split',
  'no_action'
);

create table if not exists disputes (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references bookings(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  milestone_id uuid references contract_milestones(id) on delete set null,
  opened_by uuid not null references profiles(id) on delete cascade,
  respondent_id uuid references profiles(id) on delete set null,
  title text not null,
  reason text not null,
  description text not null,
  status dispute_status not null default 'open',
  outcome dispute_outcome not null default 'pending',
  resolution_notes text,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_disputes_opened_by on disputes(opened_by);
create index if not exists idx_disputes_status on disputes(status, created_at desc);
create index if not exists idx_disputes_booking on disputes(booking_id);
create index if not exists idx_disputes_contract on disputes(contract_id);

create table if not exists dispute_evidence (
  id uuid primary key default uuid_generate_v4(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  note text,
  file_name text,
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dispute_evidence_dispute on dispute_evidence(dispute_id, created_at);

alter table disputes enable row level security;
alter table dispute_evidence enable row level security;

create policy "Participants read disputes"
  on disputes for select
  to authenticated
  using (
    auth.uid() = opened_by
    or auth.uid() = respondent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Users open disputes"
  on disputes for insert
  to authenticated
  with check (auth.uid() = opened_by);

create policy "Participants read evidence"
  on dispute_evidence for select
  to authenticated
  using (
    exists (
      select 1 from disputes d
      where d.id = dispute_id
        and (
          d.opened_by = auth.uid()
          or d.respondent_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

create policy "Participants add evidence"
  on dispute_evidence for insert
  to authenticated
  with check (
    auth.uid() = uploaded_by
    and exists (
      select 1 from disputes d
      where d.id = dispute_id
        and (d.opened_by = auth.uid() or d.respondent_id = auth.uid())
        and d.status in ('open', 'under_review', 'mediation')
    )
  );

-- Private bucket for dispute evidence uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dispute-evidence',
  'dispute-evidence',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "Dispute participants read evidence files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'dispute-evidence'
    and exists (
      select 1 from dispute_evidence de
      join disputes d on d.id = de.dispute_id
      where de.storage_path = name
        and (
          d.opened_by = auth.uid()
          or d.respondent_id = auth.uid()
          or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

create policy "Dispute participants upload evidence files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dispute-evidence'
    and (storage.foldername(name))[1]::uuid in (
      select d.id from disputes d
      where d.opened_by = auth.uid() or d.respondent_id = auth.uid()
    )
  );
