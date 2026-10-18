import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDisplayUser } from '@/lib/auth';

// GET /api/realtime/topic — the caller's private Broadcast topic. Works for
// admin and display sessions alike; returns null when signed out so the
// client simply skips live updates.
export async function GET(request: NextRequest) {
  const user = await getDisplayUser(request);
  if (!user) return NextResponse.json({ topic: null });

  const { data } = await createServiceClient()
    .from('app_users')
    .select('realtime_key')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json(
    { topic: data?.realtime_key ? `u:${data.realtime_key}` : null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
