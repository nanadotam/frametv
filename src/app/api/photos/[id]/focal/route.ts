import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireDisplayUser } from '@/lib/auth';

// Called from the display TV page after FaceDetector runs client-side.
// Uses display-user auth (not admin) since the TV is the detector.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;

    const metaPatch: Record<string, unknown> = { focal_detected: true };

    if (typeof body.focal_x === 'number' && typeof body.focal_y === 'number') {
      metaPatch.focal_x = Math.max(0, Math.min(1, body.focal_x));
      metaPatch.focal_y = Math.max(0, Math.min(1, body.focal_y));
    } else if (body.focal_detected !== true) {
      return NextResponse.json({ error: 'Invalid focal point data' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: cur } = await supabase
      .from('photos')
      .select('metadata')
      .eq('id', id)
      .eq('user_id', auth.user!.id)
      .maybeSingle();

    if (!cur) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const newMeta = { ...(cur.metadata as Record<string, unknown> ?? {}), ...metaPatch };

    await supabase
      .from('photos')
      .update({ metadata: newMeta })
      .eq('id', id)
      .eq('user_id', auth.user!.id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
