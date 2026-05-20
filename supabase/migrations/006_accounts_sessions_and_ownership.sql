-- ============================================================================
-- Migration 006 — Accounts, sessions, display PINs, ownership, and auth events
-- ============================================================================

create table if not exists public.app_users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  username       text not null unique,
  name           text not null,
  password_hash  text not null,
  pin_hash       text not null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists public.app_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.app_users(id) on delete cascade,
  session_hash   text not null unique,
  kind           text not null check (kind in ('admin', 'display')),
  device_name    text,
  ip             text,
  user_agent     text,
  browser        text,
  os             text,
  device_type    text,
  country        text,
  city           text,
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  created_at     timestamptz default now(),
  last_seen_at   timestamptz default now()
);

create index if not exists idx_app_sessions_hash on public.app_sessions(session_hash);
create index if not exists idx_app_sessions_user on public.app_sessions(user_id);

create table if not exists public.auth_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.app_users(id) on delete set null,
  event_type     text not null check (event_type in ('signup', 'login', 'pin_unlock', 'logout', 'failed_login', 'failed_pin')),
  email          text,
  device_name    text,
  ip             text,
  user_agent     text,
  browser        text,
  os             text,
  device_type    text,
  country        text,
  city           text,
  created_at     timestamptz default now()
);

create index if not exists idx_auth_events_user on public.auth_events(user_id);
create index if not exists idx_auth_events_created on public.auth_events(created_at desc);

create table if not exists public.user_modes (
  user_id        uuid not null references public.app_users(id) on delete cascade,
  id             text not null,
  name           text not null,
  description    text,
  is_enabled     boolean default true,
  config         jsonb default '{}'::jsonb,
  primary key (user_id, id)
);

create index if not exists idx_user_modes_user on public.user_modes(user_id);

alter table public.albums add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.photos add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.modes add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.display_state add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.schedules add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.reminders add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.settings add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.spotify_auth add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.drive_auth add column if not exists user_id uuid references public.app_users(id) on delete cascade;
alter table public.flipboard_messages add column if not exists user_id uuid references public.app_users(id) on delete cascade;

create index if not exists idx_albums_user on public.albums(user_id);
create index if not exists idx_photos_user on public.photos(user_id);
create index if not exists idx_modes_user on public.modes(user_id);
create index if not exists idx_display_state_user on public.display_state(user_id);
create index if not exists idx_schedules_user on public.schedules(user_id);
create index if not exists idx_reminders_user on public.reminders(user_id);
create index if not exists idx_settings_user on public.settings(user_id);
create index if not exists idx_flipboard_messages_user on public.flipboard_messages(user_id);

drop index if exists settings_pkey_user_idx;
create unique index if not exists idx_settings_user_key_unique
  on public.settings(coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

drop index if exists modes_pkey_user_idx;
create unique index if not exists idx_modes_user_id_unique
  on public.modes(coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), id);

do $$
begin
  alter table public.display_state drop constraint if exists single_row;
  alter table public.display_state alter column id drop default;
  create sequence if not exists public.display_state_id_seq;
  perform setval('public.display_state_id_seq', greatest((select coalesce(max(id), 1) from public.display_state), 1), true);
  alter table public.display_state alter column id set default nextval('public.display_state_id_seq');
exception when others then
  raise notice 'display_state sequence setup skipped: %', sqlerrm;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.photos;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.modes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_modes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.flipboard_messages;
exception when duplicate_object then null;
end $$;

create trigger app_users_updated_at before update on public.app_users
  for each row execute function public.handle_updated_at();
