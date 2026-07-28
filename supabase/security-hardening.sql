-- =============================================================================
-- Security hardening — privilege escalation, PII exposure, payment idempotency
-- Run after all prior migrations. Idempotent: safe to re-run.
--
-- Closes four issues found in the production review:
--   1. Any user could self-promote to admin via profiles.role (→ dispute payouts)
--   2. Any artist could write their own rating / total_projects / stripe_account_id
--   3. Every authenticated user could read every profile row, including email
--   4. Duplicate Stripe webhook deliveries could write duplicate payment rows
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Helpers
--
-- is_platform_admin() is SECURITY DEFINER so it reads profiles with RLS bypassed.
-- A policy ON profiles that queries profiles directly would recurse infinitely.
--
-- platform_write() marks a transaction as an internal platform write, so triggers
-- that guard user-owned columns can let the platform's own triggers through.
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin'::public.user_role
  );
$$;

alter function public.is_platform_admin(uuid) owner to postgres;
revoke all on function public.is_platform_admin(uuid) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated, service_role;

create or replace function public.platform_write_in_progress()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.platform_write', true), '') = 'on';
$$;

-- ---------------------------------------------------------------------------
-- 1) profiles.role is not user-writable
--
-- RLS UPDATE policies are row-scoped, not column-scoped, so "update your own
-- profile" also permitted `set role = 'admin'`. isAdmin() reads exactly this
-- column and it is the only gate on dispute resolution, which moves money.
--
-- A trigger (rather than a policy) enforces this because it holds no matter
-- which policy, view, or RPC the write arrives through.
--
-- Legitimate role changes are preserved:
--   * service_role / direct psql — server-side admin promotion, no JWT context
--   * employer <-> artist — the AuthContext self-heal in src/context/AuthContext.jsx
-- Becoming (or ceasing to be) an admin is never permitted from a user session.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := coalesce(auth.role(), '');
  is_trusted boolean;
begin
  -- No JWT context (psql / migrations) or the service key: trusted server path.
  -- handle_new_user() is SECURITY DEFINER but runs on the signup request's JWT,
  -- so it is covered by the 'employer'/'artist' allowance rather than this.
  is_trusted := (auth.uid() is null) or (actor_role = 'service_role');
  if is_trusted then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    -- Self-insert is permitted by RLS; seeding it as admin is not.
    if new.role = 'admin'::public.user_role then
      raise exception 'Cannot create a profile with the admin role'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: employer <-> artist is fine; anything touching admin is not.
  if new.role is not distinct from old.role then
    return new;
  end if;

  if new.role = 'admin'::public.user_role or old.role = 'admin'::public.user_role then
    raise exception 'Admin role can only be changed by the platform, not by a user session'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

alter function public.enforce_profile_role_change() owner to postgres;

drop trigger if exists trg_enforce_profile_role_change on public.profiles;
create trigger trg_enforce_profile_role_change
  before insert or update of role on public.profiles
  for each row execute function public.enforce_profile_role_change();

-- ---------------------------------------------------------------------------
-- 2) artists: platform-owned columns are not artist-writable
--
-- rating and total_projects are derived by the platform (update_artist_rating
-- trigger); stripe_account_id is written only by api/_lib/stripeConnect.js under
-- the service key. Letting an artist set their own rating would make the
-- Leaderboard and search ranking self-reported.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_artist_platform_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := coalesce(auth.role(), '');
begin
  -- Trusted paths: no JWT context (psql / migrations), the service key, or a
  -- platform trigger such as update_artist_rating, which recomputes `rating`
  -- while the reviewer's JWT is still the active session.
  if (auth.uid() is null)
     or (actor_role = 'service_role')
     or public.platform_write_in_progress()
  then
    return new;
  end if;

  -- Silently preserve the stored values rather than erroring, so a full-row
  -- update from the profile editor still succeeds for the fields it owns.
  new.rating            := old.rating;
  new.total_projects    := old.total_projects;
  new.stripe_account_id := old.stripe_account_id;

  return new;
end;
$$;

alter function public.enforce_artist_platform_columns() owner to postgres;

drop trigger if exists trg_enforce_artist_platform_columns on public.artists;
create trigger trg_enforce_artist_platform_columns
  before update on public.artists
  for each row execute function public.enforce_artist_platform_columns();

-- ---------------------------------------------------------------------------
-- 2b) Let the rating trigger through the guard above
--
-- update_artist_rating fires on review insert and writes artists.rating while the
-- reviewer's JWT is the active session, which the guard would otherwise revert.
-- Marking the write keeps the derived rating authoritative.
-- ---------------------------------------------------------------------------
create or replace function public.update_artist_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.platform_write', 'on', true);  -- true = transaction-local

  update public.artists set
    rating = (
      select avg(rating)::numeric(2,1)
      from public.reviews
      where reviewee_artist_id = new.reviewee_artist_id
    )
  where id = new.reviewee_artist_id;

  perform set_config('app.platform_write', 'off', true);
  return new;
end;
$$;

alter function public.update_artist_rating() owner to postgres;

-- ---------------------------------------------------------------------------
-- 3) profiles: stop leaking every user's email
--
-- `using (true)` let any authenticated session dump the whole user table,
-- email included. All client-side profile access is self-scoped
-- (src/context/AuthContext.jsx, src/pages/Account.jsx), and server code uses the
-- service key, which bypasses RLS — so self + admin is sufficient today.
--
-- Counterparty display names come from `artists` (still public) and denormalized
-- columns such as bookings.artist_name. If a future feature needs to read another
-- user's profile from the client, expose a view of the non-sensitive columns
-- rather than widening this policy.
-- ---------------------------------------------------------------------------
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Profiles are viewable by self or admin" on public.profiles;

create policy "Profiles are viewable by self or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 4) Payment idempotency
--
-- A Stripe Checkout session emits BOTH checkout.session.completed and
-- payment_intent.succeeded with the same metadata, and Stripe retries any
-- non-2xx. The read-then-write guards in completeBookingPayment /
-- completeMilestonePayment race under concurrent delivery, so the uniqueness is
-- enforced here instead.
-- ---------------------------------------------------------------------------

-- One paid payment row per booking, and per milestone.
create unique index if not exists uniq_payments_booking_paid
  on public.payments (booking_id)
  where status = 'paid' and booking_id is not null;

create unique index if not exists uniq_payments_milestone_paid
  on public.payments (milestone_id)
  where status = 'paid' and milestone_id is not null;

-- One payment row per Stripe PaymentIntent, whatever it is attached to.
create unique index if not exists uniq_payments_payment_intent
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Webhook delivery ledger — the claim is an INSERT on the primary key, so
-- concurrent deliveries are settled by Postgres rather than by application code.
create table if not exists public.stripe_webhook_events (
  id           text primary key,           -- Stripe event id (evt_...)
  type         text not null,
  processed_at timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_processed
  on public.stripe_webhook_events (processed_at desc);

comment on table public.stripe_webhook_events is
  'Idempotency ledger for Stripe webhook deliveries. A row is claimed before processing and deleted if processing fails so Stripe can retry.';

-- Service-role only: no user session should read or write the ledger.
alter table public.stripe_webhook_events enable row level security;
