// GET/PUT /api/admin/line-settings — LINE縁ミッションBotの設定（単一行・パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer.from('line_bot_settings').select('*').eq('id', 'main').maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    settings: data ?? { id: 'main', group_id: '', mission_interval_days: 14, auto_push: false, auto_welcome: false, members: [] },
  });
}

export async function PUT(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    group_id?: string; mission_interval_days?: number; auto_push?: boolean; auto_welcome?: boolean; members?: unknown[];
  };

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('line_bot_settings')
    .upsert({
      id: 'main',
      group_id: body.group_id?.trim() || null,
      mission_interval_days: body.mission_interval_days || 14,
      auto_push: Boolean(body.auto_push),
      auto_welcome: Boolean(body.auto_welcome),
      members: body.members ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: data });
}
