-- ============================================================================
-- Migration 005 — FlipBoard messages table + flipboard config defaults
-- Run this in: Supabase Dashboard → SQL Editor
-- Project: https://supabase.com/dashboard/project/xhdsibtqcvoqyblkihsm/sql
-- ============================================================================

-- 1. FlipBoard direct-post messages table
create table if not exists public.flipboard_messages (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  author      text,
  is_active   boolean default true,
  expires_at  timestamptz,
  created_at  timestamptz default now()
);

-- 2. Open access policy (no RLS — single-user app, consistent with all tables)
alter table public.flipboard_messages enable row level security;

drop policy if exists "open" on public.flipboard_messages;
create policy "open" on public.flipboard_messages
  for all using (true) with check (true);

-- 3. Seed flipboard mode config with good defaults
--    (sources: reminders + quotes + messages, 8s per message, no sound)
insert into public.modes (id, name, description, is_enabled, config)
values (
  'flipboard',
  'FlipBoard',
  'Split-flap display with reminders, quotes, and board posts',
  true,
  '{"sources":["reminders","quotes","messages"],"seconds_per_message":8,"sound":false}'::jsonb
)
on conflict (id) do update
  set config = modes.config ||
    '{"sources":["reminders","quotes","messages"],"seconds_per_message":8,"sound":false}'::jsonb
  where modes.config->>'sources' is null
     or modes.config->'sources' = '[]'::jsonb;

-- 4. Ensure app_settings row exists (safe no-op if already present)
insert into public.settings (key, value)
values (
  'app_settings',
  '{"latitude":5.6037,"longitude":-0.187,"auto_theme":false,"night_dim_enabled":false,"night_dim_start":"22:00","night_dim_end":"07:00"}'::jsonb
)
on conflict (key) do nothing;
