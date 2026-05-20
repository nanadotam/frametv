import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser, requireDisplayUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('flipboard_messages')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser(request);
    if (auth.response) return auth.response;

    const body = await request.json();
    const { text, author, expires_in_hours } = body;
    if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    const expires_at = expires_in_hours
      ? new Date(Date.now() + expires_in_hours * 3600 * 1000).toISOString()
      : null;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('flipboard_messages')
      .insert({ text: text.trim(), author: author?.trim() || null, expires_at, user_id: auth.user.id })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
