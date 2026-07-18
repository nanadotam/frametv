-- ============================================================================
-- Migration 010 — TV pairing codes (Netflix/Apple TV-style device login)
-- ============================================================================

create table if not exists public.tv_pairing_codes (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'expired', 'consumed')),
  user_id        uuid references public.app_users(id) on delete cascade,
  device_name    text,
  ip             text,
  user_agent     text,
  browser        text,
  os             text,
  device_type    text,
  country        text,
  city           text,
  created_at     timestamptz not null default now(),
  approved_at    timestamptz,
  expires_at     timestamptz not null
);

create index if not exists idx_tv_pairing_codes_code on public.tv_pairing_codes(code);
create index if not exists idx_tv_pairing_codes_expires on public.tv_pairing_codes(expires_at);

alter table public.auth_events drop constraint if exists auth_events_event_type_check;
alter table public.auth_events add constraint auth_events_event_type_check
  check (event_type in ('signup', 'login', 'pin_unlock', 'logout', 'failed_login', 'failed_pin', 'tv_pair_approved', 'tv_pair_consumed'));
