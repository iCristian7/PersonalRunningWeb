-- Run once in the Supabase SQL Editor. Imported health data is private to its owner.
begin;

create table public.synced_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null check (source = 'samsung_health'),
  source_id text not null check (length(source_id) between 1 and 256),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  timezone text not null,
  title text not null default 'Running',
  distance_m double precision check (distance_m >= 0),
  active_duration_s double precision check (active_duration_s >= 0),
  hr_avg double precision check (hr_avg > 0 and hr_avg <= 300),
  hr_max double precision check (hr_max > 0 and hr_max <= 300),
  cadence_avg double precision check (cadence_avg >= 0),
  elevation_gain_m double precision check (elevation_gain_m >= 0),
  calories_kcal double precision check (calories_kcal >= 0),
  -- Preserve user-entered information separately from synchronization updates.
  sensations text,
  shoe text,
  notes text,
  -- Optional structured laps/zones: absence means unavailable, never zero.
  laps jsonb check (laps is null or jsonb_typeof(laps) = 'array'),
  heart_rate_zones jsonb check (heart_rate_zones is null or jsonb_typeof(heart_rate_zones) = 'array'),
  imported_at timestamptz not null default now(),
  constraint synced_workouts_time_order check (ended_at > started_at),
  constraint synced_workouts_unique_source unique (user_id, source, source_id)
);

create index synced_workouts_owner_time on public.synced_workouts (user_id, started_at desc);

alter table public.synced_workouts enable row level security;
revoke all on public.synced_workouts from anon;
grant select, insert, update, delete on public.synced_workouts to authenticated;

create policy "Read own workouts" on public.synced_workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own workouts" on public.synced_workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workouts" on public.synced_workouts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own workouts" on public.synced_workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
