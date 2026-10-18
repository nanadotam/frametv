import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isRateLimited, recordAuthEvent, tooManyAttempts } from '@/lib/auth';
import { mintScreensaverToken, normalizeScreensaverCode } from '@/lib/screensaverCode';

// POST { code } — called by the screensaver's Options panel. Single use:
// swaps a connect code for this Mac's own screensaver token.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const code = normalizeScreensaverCode(String(body.code ?? ''));
  if (!code) return NextResponse.json({ error: 'Codes look like ABCD-EFGH.' }, { status: 400 });

  if (await isRateLimited(request, 'failed_pin', null, { maxPerIp: 15 })) return tooManyAttempts();

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('settings')
    .delete()
    .eq('key', `sscode:${code}`)
    .select('user_id, value')
    .maybeSingle();

  const expired = row && new Date((row.value as { expires_at: string }).expires_at).getTime() < Date.now();
  if (!row?.user_id || expired) {
    await recordAuthEvent(request, 'failed_pin', { device_name: 'Mantel Screensaver (Mac)' });
    return NextResponse.json({ error: 'That code is wrong or has expired. Get a new one in the Mantel app.' }, { status: 400 });
  }

  const token = await mintScreensaverToken(request, row.user_id);
  return NextResponse.json({ token, deviceToken: token, origin: request.nextUrl.origin });
}
