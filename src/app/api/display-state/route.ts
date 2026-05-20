import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser, requireDisplayUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('display_state')
      .select('*')
      .eq('user_id', auth.user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ state: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const body = await request.json();

    const allowedFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ('active_mode_id' in body) allowedFields.active_mode_id = body.active_mode_id;
    if ('active_album_ids' in body) allowedFields.active_album_ids = body.active_album_ids;
    if (typeof body.is_paused === 'boolean') allowedFields.is_paused = body.is_paused;
    if (typeof body.brightness === 'number') {
      // Clamp to 5–100
      allowedFields.brightness = Math.min(100, Math.max(5, body.brightness));
    }
    if ('override_until' in body) allowedFields.override_until = body.override_until;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('display_state')
      .update(allowedFields)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ state: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
