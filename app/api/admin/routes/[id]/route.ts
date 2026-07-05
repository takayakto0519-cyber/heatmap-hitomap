import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function checkAdmin(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password');
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && provided === expected;
}

// PATCH /api/admin/routes/[id] — 協賛の設定（手動、決済は伴わない。合言葉必須）
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as { sponsor_name?: string | null; sponsor_url?: string | null };
  const updates: Record<string, unknown> = {};
  if ('sponsor_name' in body) updates.sponsor_name = body.sponsor_name;
  if ('sponsor_url' in body) updates.sponsor_url = body.sponsor_url;

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer.from('routes').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, route: data });
}
