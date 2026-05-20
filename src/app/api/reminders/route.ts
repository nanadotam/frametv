import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminUser, requireDisplayUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDisplayUser(request);
    if (auth.response) return auth.response;

    const supabase = createServiceClient();
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('is_done', false)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reminders: reminders ?? [] });
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
    const { text, priority, show_on_board, due_at } = body;

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const validPriorities = [
      'urgent_important',
      'not_urgent_important',
      'urgent_not_important',
      'not_urgent_not_important',
    ];
    if (!priority || !validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `priority must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const { data: reminder, error } = await supabase
      .from('reminders')
      .insert({
        text,
        user_id: auth.user.id,
        priority,
        show_on_board: show_on_board ?? true,
        due_at: due_at ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
