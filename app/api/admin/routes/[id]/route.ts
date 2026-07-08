import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function checkAdmin(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password');
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && provided === expected;
}

interface RouteAdminUpdateBody {
  sponsor_name?: string | null;
  sponsor_url?: string | null;
  event_slug?: string | null;
  event_cover_url?: string | null;
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  event_area?: string | null;
  event_mode?: string | null;
  event_session_code?: string | null;
}

const ALLOWED_FIELDS: (keyof RouteAdminUpdateBody)[] = [
  'sponsor_name', 'sponsor_url',
  'event_slug', 'event_cover_url', 'event_starts_at', 'event_ends_at', 'event_area',
  'event_mode', 'event_session_code',
];

// PATCH /api/admin/routes/[id] — 協賛・イベント公開情報の設定（手動、決済は伴わない。合言葉必須）
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as RouteAdminUpdateBody;
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer.from('routes').update(updates).eq('id', id).select().single();
  if (error) {
    const message = error.message.includes('routes_event_slug_key')
      ? 'このURL（スラッグ）は既に使われています'
      : error.message;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, route: data });
}
