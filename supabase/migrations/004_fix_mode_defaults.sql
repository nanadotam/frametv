-- Fix unsplash-mood default interval to 2 minutes (120s) to match the mode component
UPDATE public.modes
SET config = config || '{"intervalSeconds": 120}'::jsonb
WHERE id = 'unsplash-mood'
  AND (config->>'intervalSeconds')::int < 120
  OR config->>'intervalSeconds' IS NULL;
