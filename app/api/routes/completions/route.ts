import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// GET /api/routes/completions?user_id=xxx — 指定ユーザーの累計ルート踏破数（バッジ判定用）
export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: true, count: 0 });
  }
  const userId = req.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ ok: false, count: 0, error: 'user_idが必要です' }, { status: 400 });
  }
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { count, error } = await supabaseServer
    .from('route_completions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return NextResponse.json({ ok: false, count: 0, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: count ?? 0 });
}
