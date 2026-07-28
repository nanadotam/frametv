import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireDisplayUser } from '@/lib/auth';
import { ensureUserDefaults } from '@/lib/userData';

// user_modes only changes via admin edits (mode toggle/rename/config save),
// both of which call invalidateModesCache(userId). Realtime still pushes a
// "something changed" signal to connected displays immediately — this cache
// only affects the GET fallback path (cold load without SSR data, periodic
// 60s poll, focus/storage refetch), so a short stale window is safe.
const getCachedModes = unstable_cache(
  async (userId: string) => {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('user_modes')
      .select('*')
      .eq('user_id', userId)
      .order('id');
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ['user-modes'],
  { revalidate: 30, tags: ['user-modes'] }
);

export async function GET(request: NextRequest) {
  const auth = await requireDisplayUser(request);
  if (auth.response) return auth.response;

  await ensureUserDefaults(auth.user.id);

  try {
    const modes = await getCachedModes(auth.user.id);
    return NextResponse.json({ modes });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
