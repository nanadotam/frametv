import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizePairingCode } from '@/lib/auth';

// GET /api/auth/pair/status?code=XXXXXX — polled by the TV while it waits
// for the phone to approve. Read-only; does not mutate or consume the code.
export async function GET(request: NextRequest) {
  const code = normalizePairingCode(request.nextUrl.searchParams.get('code') ?? '');
  if (!code) {
    return NextResponse.json({ error: 'Missing code.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('tv_pairing_codes')
    .select('status, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ status: 'invalid' });
  }

  const isStale = (data.status === 'pending' || data.status === 'approved') && new Date(data.expires_at).getTime() < Date.now();
  if (isStale) {
    await supabase.from('tv_pairing_codes').update({ status: 'expired' }).eq('code', code).eq('status', data.status);
    return NextResponse.json({ status: 'expired' });
  }

  return NextResponse.json({ status: data.status });
}
