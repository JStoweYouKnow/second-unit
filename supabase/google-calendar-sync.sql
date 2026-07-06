-- Google Calendar OAuth sync (two-way: push bookings, import busy blocks).
-- Run after schema.sql

create table if not exists calendar_connections (
  profile_id uuid primary key references profiles(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  token_expires_at timestamptz,
  calendar_id text not null default 'primary',
  sync_enabled boolean not null default true,
  event_map jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists calendar_oauth_states (
  state text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null
);

create index if not exists idx_calendar_oauth_states_expires on calendar_oauth_states(expires_at);

-- Busy blocks imported from Google Calendar (artist availability overlay)
create table if not exists google_busy_blocks (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  artist_id uuid references artists(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  source_event_id text,
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_google_busy_artist_date on google_busy_blocks(artist_id, date);

-- No RLS on calendar_connections — service role API only

alter table google_busy_blocks enable row level security;

create policy "Anyone can read google busy blocks for artists"
  on google_busy_blocks for select
  using (true);
