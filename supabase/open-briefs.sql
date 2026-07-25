-- Open-brief marketplace: hirers post briefs publicly; artists browse and apply.
-- Run after schema.sql (needs profiles, artists) and notifications.sql.

create table if not exists open_briefs (
  id uuid primary key default uuid_generate_v4(),
  employer_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  budget_min integer,
  budget_max integer,
  timeline text,
  location text default 'Remote',
  skills text[] default '{}',
  status text not null default 'open' check (status in ('open', 'closed', 'filled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_open_briefs_status on open_briefs(status, created_at desc);
create index if not exists idx_open_briefs_employer on open_briefs(employer_id, created_at desc);

create table if not exists brief_applications (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid not null references open_briefs(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  message text not null default '',
  proposed_rate integer,
  status text not null default 'pending' check (status in ('pending', 'shortlisted', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brief_id, artist_id)
);

create index if not exists idx_brief_apps_brief on brief_applications(brief_id, created_at desc);
create index if not exists idx_brief_apps_artist on brief_applications(artist_id, created_at desc);

alter table open_briefs enable row level security;
alter table brief_applications enable row level security;

-- Open briefs are browsable by any authenticated user; the owner sees their own
-- in any status; admins see all.
create policy "Browse open briefs"
  on open_briefs for select
  to authenticated
  using (
    status = 'open'
    or employer_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Employers post briefs"
  on open_briefs for insert
  to authenticated
  with check (employer_id = auth.uid());

create policy "Employers manage own briefs"
  on open_briefs for update
  to authenticated
  using (employer_id = auth.uid())
  with check (employer_id = auth.uid());

create policy "Employers delete own briefs"
  on open_briefs for delete
  to authenticated
  using (employer_id = auth.uid());

-- Applications are visible to the applying artist and the brief's employer.
create policy "Read own or received applications"
  on brief_applications for select
  to authenticated
  using (
    auth.uid() in (select profile_id from artists where id = artist_id)
    or auth.uid() in (select employer_id from open_briefs where id = brief_id)
  );

create policy "Artists apply as themselves"
  on brief_applications for insert
  to authenticated
  with check (
    auth.uid() in (select profile_id from artists where id = artist_id)
    and exists (select 1 from open_briefs b where b.id = brief_id and b.status = 'open')
  );

-- Employers set application status; artists may update their own (e.g. withdraw message).
create policy "Employers update received applications"
  on brief_applications for update
  to authenticated
  using (auth.uid() in (select employer_id from open_briefs where id = brief_id))
  with check (auth.uid() in (select employer_id from open_briefs where id = brief_id));

create policy "Artists withdraw own applications"
  on brief_applications for delete
  to authenticated
  using (auth.uid() in (select profile_id from artists where id = artist_id));
