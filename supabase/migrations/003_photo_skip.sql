-- Add photo_skip counter to display_state.
-- Incrementing signals "next photo", decrementing signals "previous photo".
-- The display page watches for changes via realtime and calls advance/previous accordingly.

ALTER TABLE public.display_state
  ADD COLUMN IF NOT EXISTS photo_skip integer not null default 0;
