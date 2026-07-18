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
