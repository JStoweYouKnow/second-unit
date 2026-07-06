-- Contract-linked milestone payments (33/33/34 default split).
-- Run after schema.sql, payments-escrow.sql, product-gaps-migration.sql

create type milestone_status as enum (
  'awaiting_payment',
  'funded',
  'released',
  'cancelled'
);

create table if not exists contract_milestones (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references contracts(id) on delete cascade,
  sort_order integer not null default 0,
  title text not null,
  description text,
  amount integer not null,
  status milestone_status not null default 'awaiting_payment',
  payment_id uuid references payments(id),
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  released_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_contract_milestones_contract
  on contract_milestones (contract_id, sort_order);

alter table payments
  add column if not exists milestone_id uuid references contract_milestones(id);

alter table contract_milestones enable row level security;

create policy "Contract participants can view milestones" on contract_milestones for select
  using (
    contract_id in (
      select id from contracts where employer_id = auth.uid()
      union
      select id from contracts where artist_id in (
        select id from artists where profile_id = auth.uid()
      )
    )
  );
