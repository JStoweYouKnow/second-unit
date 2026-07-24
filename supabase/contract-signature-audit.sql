-- Stronger e-sign audit trail (typed ESIGN, not DocuSign).
-- Run after product-gaps-migration.sql

alter table public.contracts
  add column if not exists signed_by_employer_at timestamptz,
  add column if not exists signed_by_artist_at timestamptz,
  add column if not exists document_hash text;

-- Append-only event log for each signature action
create table if not exists public.contract_signature_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  signer_user_id uuid not null references public.profiles(id),
  party text not null check (party in ('employer', 'artist')),
  signature_name text not null,
  signed_at timestamptz not null default now(),
  ip text,
  user_agent text,
  document_hash text not null,
  method text not null default 'typed_esign',
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_signature_events_contract
  on public.contract_signature_events(contract_id, signed_at);

alter table public.contract_signature_events enable row level security;

drop policy if exists "Contract parties can read signature events" on public.contract_signature_events;
create policy "Contract parties can read signature events"
on public.contract_signature_events for select
to authenticated
using (
  exists (
    select 1 from public.contracts c
    where c.id = contract_id
      and (
        c.employer_id = auth.uid()
        or auth.uid() in (select profile_id from public.artists where id = c.artist_id)
      )
  )
);

-- Inserts go through service role / server only (no authenticated insert policy).
