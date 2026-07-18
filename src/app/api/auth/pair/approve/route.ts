import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizePairingCode, recordAuthEvent, requireAdminUser } from '@/lib/auth';

// POST /api/auth/pair/approve — called from the phone/dashboard once the
// user confirms "yes, this is my TV". Requires an authenticated admin
// session; the TV itself never calls this route.
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const code = normalizePairingCode(String(body.code ?? ''));
  if (!code) {
    return NextResponse.json({ error: 'Missing code.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('tv_pairing_codes')
    .update({ status: 'approved', user_id: auth.user.id, approved_at: new Date().toISOString() })
    .eq('code', code)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .select('id, device_name')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 400 });
  }

  await recordAuthEvent(request, 'tv_pair_approved', { user_id: auth.user.id, email: auth.user.email });

  return NextResponse.json({ ok: true, device_name: data.device_name ?? null });
}
