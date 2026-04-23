-- =============================================
-- Second Unit — Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================
create type user_role as enum ('employer', 'artist', 'admin');
create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type contract_status as enum ('draft', 'pending', 'active', 'completed', 'cancelled');
create type contract_type as enum ('standard', 'custom');
create type payment_status as enum ('pending', 'paid', 'refunded', 'failed');
create type message_sender as enum ('employer', 'artist');

-- =============================================
-- PROFILES (extends Supabase auth.users)
-- =============================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  avatar_url text,
  role user_role not null default 'employer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- ARTISTS (artist-specific data)
-- =============================================
create table artists (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  display_name text not null,
  role_title text not null, -- e.g. 'AI Visual Artist'
  bio text,
  hourly_rate integer not null default 0,
  location text,
  available boolean default true,
  rating numeric(2,1) default 0.0,
  total_projects integer default 0,
  website text,
  twitter text,
  instagram text,
  linkedin text,
  video_links text[] default '{}',
  stripe_account_id text, -- Stripe Connect account
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- SKILLS
-- =============================================
create table skills (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

create table artist_skills (
  artist_id uuid references artists(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  primary key (artist_id, skill_id)
);

-- =============================================
-- BRANDS (clients/brands artists have worked with)
-- =============================================
create table brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  logo_url text
);

create table artist_brands (
  artist_id uuid references artists(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  primary key (artist_id, brand_id)
);

-- =============================================
-- AVAILABILITY SLOTS
-- =============================================
create table availability_slots (
  id uuid primary key default uuid_generate_v4(),
  artist_id uuid not null references artists(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_booked boolean default false,
  created_at timestamptz default now()
);

create index idx_availability_artist_date on availability_slots(artist_id, date);

-- =============================================
-- FAVORITES
-- =============================================
create table favorites (
  employer_id uuid references profiles(id) on delete cascade,
  artist_id uuid references artists(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (employer_id, artist_id)
);

-- =============================================
-- CONVERSATIONS & MESSAGES
-- =============================================
create table conversations (
  id uuid primary key default uuid_generate_v4(),
  employer_id uuid not null references profiles(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  employer_unread integer default 0,
  artist_unread integer default 0,
  created_at timestamptz default now(),
  unique(employer_id, artist_id)
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  sender_role message_sender not null,
  body text not null,
  created_at timestamptz default now()
);

create index idx_messages_conversation on messages(conversation_id, created_at);

-- =============================================
-- BOOKINGS
-- =============================================
create table bookings (
  id uuid primary key default uuid_generate_v4(),
  employer_id uuid not null references profiles(id),
  artist_id uuid not null references artists(id),
  date date not null,
  start_time time not null,
  duration_hours numeric(4,1) not null,
  booking_type text not null, -- 'Consultation', 'Project Work', etc.
  rate integer not null, -- hourly rate at time of booking
  status booking_status default 'pending',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- CONTRACTS
-- =============================================
create table contracts (
  id uuid primary key default uuid_generate_v4(),
  employer_id uuid not null references profiles(id),
  artist_id uuid not null references artists(id),
  title text not null,
  contract_type contract_type default 'standard',
  status contract_status default 'draft',
  total_value integer not null default 0,
  start_date date,
  end_date date,
  terms text, -- custom terms if contract_type = 'custom'
  signed_by_employer boolean default false,
  signed_by_artist boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- PAYMENTS
-- =============================================
create table payments (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid references contracts(id),
  booking_id uuid references bookings(id),
  employer_id uuid not null references profiles(id),
  artist_id uuid not null references artists(id),
  amount integer not null, -- in cents
  description text,
  status payment_status default 'pending',
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================
-- REVIEWS
-- =============================================
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid references contracts(id),
  reviewer_id uuid not null references profiles(id),
  reviewee_artist_id uuid references artists(id),
  rating integer not null check (rating >= 1 and rating <= 5),
  body text,
  created_at timestamptz default now()
);

-- =============================================
-- PORTFOLIO ITEMS
-- =============================================
create table portfolio_items (
  id uuid primary key default uuid_generate_v4(),
  artist_id uuid not null references artists(id) on delete cascade,
  title text,
  description text,
  media_url text not null,
  media_type text default 'image', -- 'image', 'video'
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Profiles: users can read all, update their own
alter table profiles enable row level security;
create policy "Profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Artists: readable by all, writable by owner
alter table artists enable row level security;
create policy "Artists are viewable by everyone" on artists for select using (true);
create policy "Artists can update own record" on artists for update using (auth.uid() = profile_id);
create policy "Artists can insert own record" on artists for insert with check (auth.uid() = profile_id);

-- Skills & Brands: readable by all
alter table skills enable row level security;
create policy "Skills are viewable by everyone" on skills for select using (true);
alter table brands enable row level security;
create policy "Brands are viewable by everyone" on brands for select using (true);
alter table artist_skills enable row level security;
create policy "Artist skills viewable by all" on artist_skills for select using (true);
alter table artist_brands enable row level security;
create policy "Artist brands viewable by all" on artist_brands for select using (true);

-- Favorites: users manage their own
alter table favorites enable row level security;
create policy "Users can view own favorites" on favorites for select using (auth.uid() = employer_id);
create policy "Users can add favorites" on favorites for insert with check (auth.uid() = employer_id);
create policy "Users can remove favorites" on favorites for delete using (auth.uid() = employer_id);

-- Conversations: participants only
alter table conversations enable row level security;
create policy "Participants can view conversations" on conversations for select
  using (auth.uid() = employer_id or auth.uid() in (select profile_id from artists where id = artist_id));
create policy "Employers can start conversations" on conversations for insert
  with check (auth.uid() = employer_id);

-- Messages: participants only
alter table messages enable row level security;
create policy "Participants can view messages" on messages for select
  using (conversation_id in (
    select id from conversations where employer_id = auth.uid()
    union select id from conversations where artist_id in (select id from artists where profile_id = auth.uid())
  ));
create policy "Participants can send messages" on messages for insert
  with check (auth.uid() = sender_id);

-- Bookings: participants only
alter table bookings enable row level security;
create policy "Participants can view bookings" on bookings for select
  using (auth.uid() = employer_id or auth.uid() in (select profile_id from artists where id = artist_id));
create policy "Employers can create bookings" on bookings for insert with check (auth.uid() = employer_id);
create policy "Participants can update bookings" on bookings for update
  using (auth.uid() = employer_id or auth.uid() in (select profile_id from artists where id = artist_id));

-- Contracts: participants only
alter table contracts enable row level security;
create policy "Participants can view contracts" on contracts for select
  using (auth.uid() = employer_id or auth.uid() in (select profile_id from artists where id = artist_id));
create policy "Employers can create contracts" on contracts for insert with check (auth.uid() = employer_id);
create policy "Participants can update contracts" on contracts for update
  using (auth.uid() = employer_id or auth.uid() in (select profile_id from artists where id = artist_id));

-- Payments: participants only
alter table payments enable row level security;
create policy "Participants can view payments" on payments for select
  using (auth.uid() = employer_id or auth.uid() in (select profile_id from artists where id = artist_id));

-- Reviews: public read, author write
alter table reviews enable row level security;
create policy "Reviews are viewable by everyone" on reviews for select using (true);
create policy "Users can create reviews" on reviews for insert with check (auth.uid() = reviewer_id);

-- Portfolio: public read, artist write
alter table portfolio_items enable row level security;
create policy "Portfolio viewable by everyone" on portfolio_items for select using (true);
create policy "Artists manage own portfolio" on portfolio_items for all
  using (auth.uid() in (select profile_id from artists where id = artist_id));

-- Availability: public read, artist write
alter table availability_slots enable row level security;
create policy "Availability viewable by everyone" on availability_slots for select using (true);
create policy "Artists manage own availability" on availability_slots for all
  using (auth.uid() in (select profile_id from artists where id = artist_id));

-- =============================================
-- FUNCTION: Auto-create profile on signup
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employer')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- FUNCTION: Update artist rating on new review
-- =============================================
create or replace function public.update_artist_rating()
returns trigger as $$
begin
  update artists set
    rating = (select avg(rating)::numeric(2,1) from reviews where reviewee_artist_id = new.reviewee_artist_id)
  where id = new.reviewee_artist_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_review_created
  after insert on reviews
  for each row execute function public.update_artist_rating();
