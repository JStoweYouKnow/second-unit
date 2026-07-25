-- Allow artists to sync their own skills/brands via SECURITY DEFINER helpers.
-- Fixes client upsert failures (skills/brands tables have INSERT RLS but no UPDATE).
-- Run after artist-applications.sql

create or replace function public.sync_artist_skill_names(p_artist_id uuid, p_skill_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  skill_name text;
  skill_uuid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = p_artist_id and a.profile_id = auth.uid()
    )
  ) then
    raise exception 'Not allowed to update skills for this artist';
  end if;

  delete from artist_skills where artist_id = p_artist_id;

  if p_skill_names is null then
    return;
  end if;

  foreach skill_name in array p_skill_names loop
    skill_name := trim(skill_name);
    if skill_name = '' then
      continue;
    end if;

    insert into skills (name)
    values (skill_name)
    on conflict (name) do nothing;

    select id into skill_uuid from skills where name = skill_name;
    if skill_uuid is not null then
      insert into artist_skills (artist_id, skill_id)
      values (p_artist_id, skill_uuid)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.sync_artist_brand_names(p_artist_id uuid, p_brand_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  brand_name text;
  brand_uuid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = p_artist_id and a.profile_id = auth.uid()
    )
  ) then
    raise exception 'Not allowed to update brands for this artist';
  end if;

  delete from artist_brands where artist_id = p_artist_id;

  if p_brand_names is null then
    return;
  end if;

  foreach brand_name in array p_brand_names loop
    brand_name := trim(brand_name);
    if brand_name = '' then
      continue;
    end if;

    insert into brands (name)
    values (brand_name)
    on conflict (name) do nothing;

    select id into brand_uuid from brands where name = brand_name;
    if brand_uuid is not null then
      insert into artist_brands (artist_id, brand_id)
      values (p_artist_id, brand_uuid)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

alter function public.sync_artist_skill_names(uuid, text[]) owner to postgres;
alter function public.sync_artist_brand_names(uuid, text[]) owner to postgres;

grant execute on function public.sync_artist_skill_names(uuid, text[]) to authenticated;
grant execute on function public.sync_artist_brand_names(uuid, text[]) to authenticated;
