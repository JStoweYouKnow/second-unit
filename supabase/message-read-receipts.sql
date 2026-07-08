-- Per-conversation read timestamps for message read receipts.
alter table conversations
  add column if not exists employer_last_read_at timestamptz,
  add column if not exists artist_last_read_at timestamptz;

comment on column conversations.employer_last_read_at is 'When the hirer last opened the thread (for artist-sent message read receipts).';
comment on column conversations.artist_last_read_at is 'When the artist last opened the thread (for hirer-sent message read receipts).';
