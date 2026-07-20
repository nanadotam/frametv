import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { clearSessionCookies, recordAuthEvent, requireAdminUser, verifyPassword } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => ({}));
    const password = String(body.password ?? '');

    const supabase = createServiceClient();
    const { data: user } = await supabase
      .from('app_users')
      .select('id, email, password_hash')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    const { data: photos } = await supabase
      .from('photos')
      .select('storage_path, thumbnail_path')
      .eq('user_id', user.id);

    const paths = (photos ?? [])
      .flatMap((photo) => [photo.storage_path, photo.thumbnail_path])
      .filter((path): path is string => Boolean(path));

    if (paths.length) {
      await supabase.storage.from('photos').remove(paths);
    }

    // Record before deleting: auth_events.user_id references app_users and
    // would fail its foreign key once the row is gone.
    await recordAuthEvent(request, 'account_deleted', { user_id: user.id, email: user.email });

    const { error } = await supabase.from('app_users').delete().eq('id', user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true });
    clearSessionCookies(response);
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
