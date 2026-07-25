-- Artist working timezone for availability calendars (IANA, e.g. America/Los_Angeles).

alter table public.artists
  add column if not exists timezone text;

comment on column public.artists.timezone is
  'IANA timezone for availability slots and “today” (e.g. America/New_York).';
