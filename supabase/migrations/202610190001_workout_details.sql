-- Additive migration: preserves existing sessions, RLS, and manual notes.
begin;
alter table public.synced_workouts add column if not exists source_notes text;
alter table public.synced_workouts add column if not exists elapsed_duration_s double precision
  check (elapsed_duration_s >= 0);
alter table public.synced_workouts add column if not exists sync_details jsonb
  check (sync_details is null or jsonb_typeof(sync_details) = 'object');
commit;
