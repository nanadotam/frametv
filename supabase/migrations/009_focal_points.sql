-- 009_focal_points.sql
-- Adds focal-point support for smart image cropping in the grid display.
--
-- No new columns are added — focal data lives inside the existing
-- photos.metadata JSONB column under these keys:
--
--   focal_x        number  0.0–1.0  horizontal focal point (left=0, right=1)
--   focal_y        number  0.0–1.0  vertical focal point   (top=0, bottom=1)
--   focal_detected boolean true     set once detection has run (even if no face found)
--
-- Example row after detection:
--   metadata = { "rotation": 0, "focal_x": 0.48, "focal_y": 0.27, "focal_detected": true }
--
-- A partial index lets us quickly find photos that still need detection
-- (useful if you ever want to run a bulk back-fill):
--
--   SELECT id FROM photos
--   WHERE user_id = $1
--     AND (metadata->>'focal_detected') IS NULL;

CREATE INDEX IF NOT EXISTS photos_focal_missing_idx
  ON photos (user_id)
  WHERE (metadata->>'focal_detected') IS NULL;

-- Optional: index for photos that DO have a focal point stored
-- (not required for current usage but cheap and future-proof)
CREATE INDEX IF NOT EXISTS photos_focal_present_idx
  ON photos (user_id)
  WHERE (metadata->>'focal_detected') = 'true';
