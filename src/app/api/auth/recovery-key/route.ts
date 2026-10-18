import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createRecoveryKey, hashRecoveryKey, requireAdminUser, verifyPassword } from '@/lib/auth';

// GET — whether the account has a recovery key yet (never the key itself).
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const { data } = await createServiceClient()
    .from('app_users')
    .select('recovery_key_hash, recovery_key_created_at')
    .eq('id', auth.user.id)
    .maybeSingle();

  return NextResponse.json({
    hasKey: !!data?.recovery_key_hash,
    createdAt: data?.recovery_key_created_at ?? null,
  });
}

// POST { password } — issue a new recovery key, replacing any old one.
// Requires the password so a borrowed, unlocked phone can't mint one.
// Accounts created before recovery keys existed may skip the password once.
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('app_users')
    .select('password_hash, recovery_key_hash')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (row.recovery_key_hash && !verifyPassword(String(body.password ?? ''), row.password_hash)) {
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }

  const recoveryKey = createRecoveryKey();
  await supabase
    .from('app_users')
    .update({ recovery_key_hash: hashRecoveryKey(recoveryKey), recovery_key_created_at: new Date().toISOString() })
    .eq('id', auth.user.id);

  return NextResponse.json({ recoveryKey });
}
