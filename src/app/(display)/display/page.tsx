import { cookies } from 'next/headers';
import { getDisplayUserFromCookieStore } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureUserDefaults } from '@/lib/userData';
import DisplayClient from './DisplayClient';
import type { DisplayState, Mode } from '@/types/db';

// Reads the session cookie and pre-fetches display_state + modes on the
// server, so the client never has to make a round-trip to /api/auth/me,
// /api/display-state, or /api/modes just to reach first paint.
export default async function DisplayPage() {
  const cookieStore = await cookies();
  const user = await getDisplayUserFromCookieStore(cookieStore);

  if (!user) {
    return <DisplayClient initialLocked initialDisplayState={null} initialModes={[]} />;
  }

  await ensureUserDefaults(user.id);

  const supabase = createServiceClient();
  const [{ data: displayState }, { data: modes }] = await Promise.all([
    supabase.from('display_state').select('*').eq('user_id', user.id).single(),
    supabase.from('user_modes').select('*').eq('user_id', user.id).order('id'),
  ]);

  return (
    <DisplayClient
      initialLocked={false}
      initialDisplayState={(displayState as DisplayState) ?? null}
      initialModes={(modes as Mode[]) ?? []}
    />
  );
}
