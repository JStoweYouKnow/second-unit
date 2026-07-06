-- Link bookings to auto-created project contracts.
-- Run after schema.sql and product-gaps-migration.sql

alter table bookings
  add column if not exists contract_id uuid references contracts(id);

create index if not exists idx_bookings_contract on bookings(contract_id);
