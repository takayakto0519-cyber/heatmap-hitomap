import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { isDemoTrace } from '@/lib/demoData';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// GET /api/admin/traces?status=pending_review — 審査待ち一覧（パスワード必須）
// GET /api/admin/traces?status=all&q=検索語&limit=100 — 投稿管理タブ用の全件検索
// GET /api/admin/traces?user_id=xxx&status=all — 特定ユーザーの全投稿（非公開・審査待ち含む）
export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get('status') ?? 'pending_review';
  const q = req.nextUrl.searchParams.get('q');
  const userId = req.nextUrl.searchParams.get('user_id');
  const includeDeleted = req.nextUrl.searchParams.get('include_deleted') === 'true';
  // 商談デモの直前など、あえて見たいときだけ ?includeDemo=true を付けて呼ぶ（lib/demoDataと同じ流儀）
  const includeDemo = req.nextUrl.searchParams.get('includeDemo') === 'true';
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 200);
  // トップページ写真グリッドの編集画面で、選択済みIDのサムネイルをまとめて引くために使う
  const idsParam = req.nextUrl.searchParams.get('ids');

  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('traces').select('*');
  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
    query = query.in('id', ids);
  } else {
    if (status !== 'all') query = query.eq('visibility', status);
    if (userId) query = query.eq('user_id', userId);
    if (!includeDeleted) query = query.eq('is_deleted', false);
    if (q) query = query.ilike('title', `%${q}%`);
  }
  query = query.order('created_at', { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const allTraces = data ?? [];
  const traces = includeDemo ? allTraces : allTraces.filter(t => !isDemoTrace(t));
  const demoHiddenCount = allTraces.length - traces.length;

  return NextResponse.json({ ok: true, traces, demoHiddenCount });
}
