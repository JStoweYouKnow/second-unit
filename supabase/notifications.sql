-- In-app notifications + Realtime delivery (production bell panel).
-- Run after schema.sql

create type notification_type as enum ('message', 'booking', 'contract', 'payment', 'system');

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null default 'system',
  title text not null,
  body text,
  link text,
  avatar text,
  read boolean not null default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on notifications(user_id)
  where read = false;

alter table notifications enable row level security;

create policy "Users read own notifications"
  on notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on notifications for update
  to authenticated
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.notifications;

-- Per-user notification + billing prefs
alter table profiles
  add column if not exists notification_prefs jsonb not null default '{
    "messages": true,
    "projects": true,
    "billing": true,
    "marketing": false
  }'::jsonb;

alter table profiles
  add column if not exists stripe_customer_id text;
