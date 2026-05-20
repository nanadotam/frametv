import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser, requireDisplayUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('priority', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedules: schedules ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { name, days_of_week, start_time, end_time, mode_id, album_ids, priority, is_enabled } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!start_time || !end_time) {
      return NextResponse.json({ error: 'start_time and end_time are required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: schedule, error } = await supabase
      .from('schedules')
      .insert({
        name,
        user_id: auth.user.id,
        days_of_week: days_of_week ?? [],
        start_time,
        end_time,
        mode_id: mode_id ?? null,
        album_ids: album_ids ?? [],
        priority: priority ?? 0,
        is_enabled: is_enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
