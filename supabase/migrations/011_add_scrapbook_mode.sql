-- ============================================================================
-- Migration 011 — Add Scrapbook display mode
-- ============================================================================

-- 1. Seed into global modes table (used as template for new users)
insert into public.modes (id, name, description, is_enabled, config)
values
  (
    'scrapbook',
    'Scrapbook',
    'Polaroids tossed and taped across the screen, 2000s style',
    true,
    '{"intervalSeconds":6,"maxOnScreen":7,"tapeFrequency":0.35,"showDate":true}'::jsonb
  )
on conflict (id) do nothing;

-- 2. Back-fill every existing user who doesn't already have this mode
insert into public.user_modes (user_id, id, name, description, is_enabled, config)
select
  u.id,
  m.id,
  m.name,
  m.description,
  m.is_enabled,
  m.config
from public.app_users u
cross join (
  select id, name, description, is_enabled, config
  from public.modes
  where id = 'scrapbook'
    and user_id is null           -- global template row only
) m
where not exists (
  select 1
  from public.user_modes um
  where um.user_id = u.id
    and um.id = m.id
);
