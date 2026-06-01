-- ============================================================================
-- Migration 008 — Display device heartbeat log
-- ============================================================================

create table if not exists public.display_devices (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.app_users(id) on delete cascade,
  client_id             text not null,
  label                 text,
  route                 text,
  renderer              text,
  active_mode_id        text,
  viewport_width        int,
  viewport_height       int,
  screen_width          int,
  screen_height         int,
  device_pixel_ratio    numeric,
  fullscreen_supported  boolean,
  fullscreen_active     boolean,
  visibility_state      text,
  device_name           text,
  ip                    text,
  user_agent            text,
  browser               text,
  os                    text,
  device_type           text,
  country               text,
  city                  text,
  first_seen_at         timestamptz default now(),
  last_seen_at          timestamptz default now(),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (user_id, client_id)
);

create index if not exists idx_display_devices_user_seen
  on public.display_devices(user_id, last_seen_at desc);

create trigger display_devices_updated_at before update on public.display_devices
  for each row execute function public.handle_updated_at();
