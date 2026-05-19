import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createServiceClient();

  const allowed: Record<string, unknown> = {};
  if (typeof body.is_enabled === 'boolean') allowed.is_enabled = body.is_enabled;
  if (body.name !== undefined) allowed.name = body.name;
  if (body.description !== undefined) allowed.description = body.description;

  const { data, error } = await supabase
    .from('modes')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mode: data });
}
