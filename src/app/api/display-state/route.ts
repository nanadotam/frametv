import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('display_state')
      .select('*')
      .eq('id', 1)
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
      .eq('id', 1)
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
