-- Allow anon (unauthenticated) writes on all tables.
-- FrameTV is a single-user personal app — no auth required.

create policy "anon write" on public.albums        for all using (true) with check (true);
create policy "anon write" on public.photos        for all using (true) with check (true);
create policy "anon write" on public.modes         for all using (true) with check (true);
create policy "anon write" on public.display_state for all using (true) with check (true);
create policy "anon write" on public.schedules     for all using (true) with check (true);
create policy "anon write" on public.reminders     for all using (true) with check (true);
create policy "anon write" on public.settings      for all using (true) with check (true);
