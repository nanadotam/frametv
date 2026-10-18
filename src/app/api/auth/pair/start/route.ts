import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createPairingCode, getDeviceInfo } from '@/lib/auth';

const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// POST /api/auth/pair/start — called by an unauthenticated TV to mint a
// fresh 6-character pairing code for the user to approve from their phone.
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const device = getDeviceInfo(request);
  const expires = new Date(Date.now() + CODE_TTL_MS);

  // An open, unpaired screen asks for a new code every 5 minutes; anything
  // much faster than that from one IP is a bot.
  if (device.ip) {
    const { count } = await supabase
      .from('tv_pairing_codes')
      .select('id', { count: 'exact', head: true })
      .eq('ip', device.ip)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= 60) {
      return NextResponse.json({ error: 'Too many pairing codes. Try again later.' }, { status: 429 });
    }
  }

  // Housekeeping: codes are useless a day after they expire.
  if (Math.random() < 0.05) {
    await supabase.from('tv_pairing_codes').delete().lt('expires_at', new Date(Date.now() - 86_400_000).toISOString());
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = createPairingCode();
    const { error } = await supabase.from('tv_pairing_codes').insert({
      code,
      status: 'pending',
      expires_at: expires.toISOString(),
      ...device,
    });
    if (!error) {
      return NextResponse.json({ code, expires_at: expires.toISOString() });
    }
    // Unique violation on `code` — regenerate and retry.
    if (error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Could not generate a pairing code. Try again.' }, { status: 500 });
}
