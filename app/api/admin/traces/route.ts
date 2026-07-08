import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function checkAdmin(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password');
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && provided === expected;
}

// GET /api/admin/traces?status=pending_review — 審査待ち一覧（合言葉必須）
// GET /api/admin/traces?status=all&q=検索語&limit=100 — 投稿管理タブ用の全件検索
export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get('status') ?? 'pending_review';
  const q = req.nextUrl.searchParams.get('q');
  const includeDeleted = req.nextUrl.searchParams.get('include_deleted') === 'true';
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 200);

  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('traces').select('*');
  if (status !== 'all') query = query.eq('visibility', status);
  if (!includeDeleted) query = query.eq('is_deleted', false);
  if (q) query = query.ilike('title', `%${q}%`);
  query = query.order('created_at', { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, traces: data ?? [] });
}
