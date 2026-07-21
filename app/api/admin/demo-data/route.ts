// /api/admin/demo-data — 営業デモ用の合成データ（scripts/seed-demo-sales-data.mjs で投入）を
// 公開マップ・自治体向けダッシュボードに反映するかどうかを、運営ダッシュボードから切り替える。
//
// 仕組み：デモの痕跡はすべて session_code='demo-sales-20260720' でタグ付けされている。
// トグルは visibility を public(表示)⇄private(非表示) に一括更新するだけ。
// トグルの現在値は site_settings に記録し、UIの初期表示に使う。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const DEMO_SESSION_CODE = 'demo-sales-20260720';
const SETTINGS_KEY = 'demo_sales_data';

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { count: totalCount } = await supabaseServer
    .from('traces').select('id', { count: 'exact', head: true }).eq('session_code', DEMO_SESSION_CODE);
  const { count: publicCount } = await supabaseServer
    .from('traces').select('id', { count: 'exact', head: true })
    .eq('session_code', DEMO_SESSION_CODE).eq('visibility', 'public');

  return NextResponse.json({
    ok: true,
    exists: (totalCount ?? 0) > 0,
    totalCount: totalCount ?? 0,
    enabled: (publicCount ?? 0) > 0,
  });
}

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'enabled(boolean)が必要です' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const nextVisibility = body.enabled ? 'public' : 'private';
  const { error } = await supabaseServer
    .from('traces')
    .update({ visibility: nextVisibility })
    .eq('session_code', DEMO_SESSION_CODE);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabaseServer.from('site_settings').upsert(
    { key: SETTINGS_KEY, value: { enabled: body.enabled, sessionCode: DEMO_SESSION_CODE }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );

  return NextResponse.json({ ok: true, enabled: body.enabled });
}
