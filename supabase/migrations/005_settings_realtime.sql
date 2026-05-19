-- Enable realtime on settings table so clock overlay config changes
-- propagate to /display immediately without a page refresh.
alter publication supabase_realtime add table public.settings;
