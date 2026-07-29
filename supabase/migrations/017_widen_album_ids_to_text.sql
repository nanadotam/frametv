-- Widen active_album_ids/album_ids from uuid[] to text[] so the
-- screensaver's "local" sentinel (a non-UUID string that usePhotos()
-- recognizes and routes to the frametv-local:// scheme handler instead of
-- Supabase) can be stored alongside real album UUIDs. Existing UUID values
-- round-trip through text unchanged.

alter table public.display_state
  alter column active_album_ids type text[] using active_album_ids::text[];

alter table public.schedules
  alter column album_ids type text[] using album_ids::text[];
