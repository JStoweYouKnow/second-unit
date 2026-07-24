-- Harden Google Calendar connection tables (tokens must not be world-readable).
-- Run after google-calendar-sync.sql

alter table if exists calendar_connections enable row level security;
alter table if exists calendar_oauth_states enable row level security;
alter table if exists google_busy_blocks enable row level security;

drop policy if exists "Users manage own calendar connections" on calendar_connections;
create policy "Users manage own calendar connections"
  on calendar_connections
  for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "Users manage own calendar oauth states" on calendar_oauth_states;
create policy "Users manage own calendar oauth states"
  on calendar_oauth_states
  for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "Users manage own google busy blocks" on google_busy_blocks;
create policy "Users manage own google busy blocks"
  on google_busy_blocks
  for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
