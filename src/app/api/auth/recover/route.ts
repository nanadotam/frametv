import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createRecoveryKey,
  hashPassword,
  hashRecoveryKey,
  isRateLimited,
  normalizeEmail,
  passwordProblem,
  recordAuthEvent,
  revokeSessions,
  startAdminSession,
  tooManyAttempts,
  verifyRecoveryKey,
} from '@/lib/auth';

// POST /api/auth/recover — reset a forgotten password with the account's
// recovery key. Signs out every device, signs this one in, and issues a
// fresh recovery key (the old one is spent).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email ?? ''));
  const recoveryKey = String(body.recoveryKey ?? '');
  const newPassword = String(body.newPassword ?? '');

  if (!email || !recoveryKey) {
    return NextResponse.json({ error: 'Enter your email and recovery key.' }, { status: 400 });
  }
  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (await isRateLimited(request, 'failed_recovery', email, { maxPerAccount: 5, maxPerIp: 10, windowMinutes: 60 })) {
    return tooManyAttempts();
  }

  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('app_users')
    .select('id, email, username, name, created_at, recovery_key_hash')
    .eq('email', email)
    .maybeSingle();

  if (!user || !verifyRecoveryKey(recoveryKey, user.recovery_key_hash)) {
    await recordAuthEvent(request, 'failed_recovery', { email });
    return NextResponse.json({ error: "That recovery key doesn't match this email." }, { status: 401 });
  }

  const nextKey = createRecoveryKey();
  const now = new Date().toISOString();
  await supabase
    .from('app_users')
    .update({
      password_hash: hashPassword(newPassword),
      password_changed_at: now,
      recovery_key_hash: hashRecoveryKey(nextKey),
      recovery_key_created_at: now,
    })
    .eq('id', user.id);

  await revokeSessions(user.id);
  await recordAuthEvent(request, 'recovery_used', { user_id: user.id, email });

  const { recovery_key_hash: _omit, ...publicUser } = user;
  void _omit;
  const response = NextResponse.json({ user: publicUser, recoveryKey: nextKey });
  await startAdminSession(request, response, user.id);
  return response;
}
