-- ============================================================================
-- Migration 007 — Add Vinyl and Scripture display modes
-- ============================================================================

-- 1. Seed into global modes table (used as template for new users)
insert into public.modes (id, name, description, is_enabled, config)
values
  (
    'scripture',
    'Scripture',
    'Verse of the day with atmospheric Unsplash backgrounds',
    true,
    '{"translation":"KJV","highlightSacredWords":true,"showCross":true,"overlayOpacity":60,"moodMappingOverrides":{}}'::jsonb
  ),
  (
    'vinyl',
    'Vinyl',
    'Spinning vinyl record with Spotify album art and dominant-color gradient',
    true,
    '{"background":"gradient"}'::jsonb
  )
on conflict (id) do nothing;

-- 2. Back-fill every existing user who doesn't already have these modes
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
  where id in ('scripture', 'vinyl')
    and user_id is null           -- global template rows only
) m
where not exists (
  select 1
  from public.user_modes um
  where um.user_id = u.id
    and um.id = m.id
);
