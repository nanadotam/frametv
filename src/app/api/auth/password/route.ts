import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  ADMIN_SESSION_COOKIE,
  hashPassword,
  hashSessionToken,
  passwordProblem,
  recordAuthEvent,
  requireAdminUser,
  revokeSessions,
  verifyPassword,
} from '@/lib/auth';

// POST { currentPassword, newPassword } — change password and sign out every
// other device. Screens (TVs, screensavers) stay connected only if
// `keepScreens` is true.
export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');

  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('app_users')
    .select('password_hash')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    return NextResponse.json({ error: 'Your current password is wrong.' }, { status: 401 });
  }

  await supabase
    .from('app_users')
    .update({ password_hash: hashPassword(newPassword), password_changed_at: new Date().toISOString() })
    .eq('id', auth.user.id);

  if (body.keepScreens) {
    await supabase
      .from('app_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', auth.user.id)
      .eq('kind', 'admin')
      .is('revoked_at', null)
      .neq('session_hash', hashSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? ''));
  } else {
    await revokeSessions(auth.user.id, request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  }

  await recordAuthEvent(request, 'password_changed', { user_id: auth.user.id, email: auth.user.email });
  return NextResponse.json({ ok: true });
}
