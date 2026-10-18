import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/auth';
import { newScreensaverCode, SCREENSAVER_CODE_TTL_MS } from '@/lib/screensaverCode';

// POST — a fresh connect code for this account (shown in the Mantel app,
// typed into the screensaver's Options panel). Replaces any older code.
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const supabase = createServiceClient();
  await supabase.from('settings').delete().eq('user_id', auth.user.id).like('key', 'sscode:%');

  const code = newScreensaverCode();
  const expiresAt = new Date(Date.now() + SCREENSAVER_CODE_TTL_MS).toISOString();
  const { error } = await supabase.from('settings').insert({
    key: `sscode:${code}`,
    user_id: auth.user.id,
    value: { expires_at: expiresAt },
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ code, expires_at: expiresAt });
}
