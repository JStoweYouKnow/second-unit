-- Light hirer onboarding: company profile + private tax-document vault (W-9 / 1099 agreements).
-- Not full KYC — stores what parties upload for their own records.

alter table public.profiles
  add column if not exists company_name text,
  add column if not exists business_type text,
  add column if not exists billing_address_line1 text,
  add column if not exists billing_city text,
  add column if not exists billing_region text,
  add column if not exists billing_postal text,
  add column if not exists billing_country text default 'US',
  add column if not exists tax_onboarding_completed_at timestamptz;

create table if not exists public.tax_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null check (doc_type in ('w9', '1099_agreement', 'other')),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tax_documents_owner on public.tax_documents(owner_id, created_at desc);

alter table public.tax_documents enable row level security;

drop policy if exists "Owners manage own tax documents" on public.tax_documents;
create policy "Owners manage own tax documents"
on public.tax_documents for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employer-tax-docs',
  'employer-tax-docs',
  false,
  15728640,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path format: {user_id}/{timestamp}-{filename}

drop policy if exists "Owners can read own tax docs" on storage.objects;
create policy "Owners can read own tax docs"
on storage.objects for select
to authenticated
using (
  bucket_id = 'employer-tax-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners can upload own tax docs" on storage.objects;
create policy "Owners can upload own tax docs"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'employer-tax-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners can update own tax docs" on storage.objects;
create policy "Owners can update own tax docs"
on storage.objects for update
to authenticated
using (
  bucket_id = 'employer-tax-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Owners can delete own tax docs" on storage.objects;
create policy "Owners can delete own tax docs"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'employer-tax-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);
