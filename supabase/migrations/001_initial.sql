-- ============================================================================
-- FrameTV — Supabase schema
-- ============================================================================

create table public.albums (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  source_type     text not null check (source_type in ('drive', 'picker', 'upload')),
  drive_folder_id text,
  cover_photo_id  uuid,
  is_archived     boolean default false,
  display_order   int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);  

create table public.photos (
  id               uuid primary key default gen_random_uuid(),
  album_id         uuid references public.albums(id) on delete cascade,
  source_type      text not null check (source_type in ('drive', 'picker', 'upload')),
  source_id        text,
  storage_path     text,
  thumbnail_path   text,
  width            int,
  height           int,
  aspect_ratio     text,
  taken_at         timestamptz,
  mime_type        text,
  bytes            bigint,
  is_favorite      boolean default false,
  metadata         jsonb default '{}'::jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index idx_photos_album on public.photos(album_id);
create index idx_photos_taken_at on public.photos(taken_at);
create index idx_photos_aspect on public.photos(aspect_ratio);

create table public.modes (
  id              text primary key,
  name            text not null,
  description     text,
  is_enabled      boolean default true,
  config          jsonb default '{}'::jsonb
);

create table public.display_state (
  id              int primary key default 1,
  active_mode_id  text references public.modes(id),
  active_album_ids uuid[] default '{}',
  is_paused       boolean default false,
  brightness      int default 100 check (brightness between 5 and 100),
  override_until  timestamptz,
  updated_at      timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into public.display_state (id) values (1) on conflict do nothing;

create table public.schedules (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  days_of_week    int[],
  start_time      time not null,
  end_time        time not null,
  mode_id         text references public.modes(id),
  album_ids       uuid[] default '{}',
  priority        int default 0,
  is_enabled      boolean default true,
  created_at      timestamptz default now()
);

create index idx_schedules_enabled on public.schedules(is_enabled);

create table public.reminders (
  id              uuid primary key default gen_random_uuid(),
  text            text not null,
  priority        text not null check (priority in ('urgent_important', 'not_urgent_important', 'urgent_not_important', 'not_urgent_not_important')),
  is_done         boolean default false,
  show_on_board   boolean default true,
  due_at          timestamptz,
  created_at      timestamptz default now()
);

create table public.settings (
  key             text primary key,
  value           jsonb not null,
  updated_at      timestamptz default now()
);

create table public.spotify_auth (
  id              int primary key default 1,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  scope           text,
  updated_at      timestamptz default now(),
  constraint single_row check (id = 1)
);

create table public.drive_auth (
  id              int primary key default 1,
  access_token    text,
  refresh_token   text,
  expires_at      timestamptz,
  scope           text,
  updated_at      timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger albums_updated_at before update on public.albums
  for each row execute function public.handle_updated_at();
create trigger photos_updated_at before update on public.photos
  for each row execute function public.handle_updated_at();
create trigger display_state_updated_at before update on public.display_state
  for each row execute function public.handle_updated_at();

-- No RLS — single-user personal app, all tables open to anon reads and writes.

-- Realtime
alter publication supabase_realtime add table public.display_state;
alter publication supabase_realtime add table public.reminders;
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.albums;

-- Seed default modes
insert into public.modes (id, name, description, is_enabled, config) values
  ('slideshow-single', 'Photo Slideshow', 'One photo at a time, full screen', true, '{"intervalSeconds":8,"transition":"fade","blurredBackdrop":true,"borderPx":4,"shuffle":true}'),
  ('slideshow-grid',   'Mixed Grid',      'Multiple photos in a smart grid', true, '{"intervalSeconds":12,"transition":"blur"}'),
  ('pinterest',        'Pinterest Grid',  'Slow-moving multi-column grid', true, '{"rows":3,"speed":1,"direction":"left","cornerRadius":24,"gap":12}'),
  ('clock-text',       'Text Clock',      'Words that spell out the time', true, '{"theme":"dark","fontSize":20,"fontFamily":"DM Sans"}'),
  ('flipboard',        'Flip Board',      'Split-flap board with reminders and quotes', true, '{"sources":["reminders","quotes","time"],"secondsPerMessage":12,"showSound":true,"cols":22,"rows":6}'),
  ('coverflow',        'Cover Flow',      'Spotify cover flow now playing', true, '{}'),
  ('unsplash-mood',    'Mood Photos',     'Unsplash photos by mood keyword', true, '{"mood":"mountains","intervalSeconds":10}'),
  ('easel',            'Easel',           'Single quote or intention on a clean canvas', true, '{"texts":["Today is a gift."],"intervalMinutes":5,"fontFamily":"Syne"}')
on conflict (id) do nothing;
