-- Web Push subscriptions for browser notifications (VAPID).
-- Run after notifications.sql

create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on push_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Extend notification prefs default to include push opt-in flag
comment on column profiles.notification_prefs is 'JSON: messages, projects, billing, marketing, push';
