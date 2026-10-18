import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ADMIN_SESSION_COOKIE, hashSessionToken, requireAdminUser } from '@/lib/auth';

// GET — every live session on the account (phones, laptops, TVs, Macs),
// newest activity first, flagging the one making this request.
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const currentHash = hashSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? '');
  const { data, error } = await createServiceClient()
    .from('app_sessions')
    .select('id, kind, device_name, device_type, browser, os, city, country, created_at, last_seen_at, expires_at, session_hash')
    .eq('user_id', auth.user.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sessions = (data ?? []).map(({ session_hash, ...s }) => ({ ...s, current: session_hash === currentHash }));
  return NextResponse.json({ sessions });
}

// DELETE ?id=<session id> revokes one; ?all=1 revokes all except this one.
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (auth.response) return auth.response;

  const id = request.nextUrl.searchParams.get('id');
  const all = request.nextUrl.searchParams.get('all') === '1';
  if (!id && !all) return NextResponse.json({ error: 'Pass id or all=1.' }, { status: 400 });

  let query = createServiceClient()
    .from('app_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', auth.user.id)
    .is('revoked_at', null);
  query = id
    ? query.eq('id', id)
    : query.neq('session_hash', hashSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? ''));

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
