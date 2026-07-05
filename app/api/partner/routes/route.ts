// ============================================================
// /api/partner/routes : 外部提携先向けAPI（APIキー認証必須）
// 「ルート機能のホワイトラベル化」用の土台。決済・請求は契約ごとに手動で行う。
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import type { ListRoutesResponse } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function checkApiKey(req: NextRequest): boolean {
  const provided = req.headers.get('x-api-key');
  const expected = process.env.PARTNER_API_KEY;
  return Boolean(expected) && provided === expected;
}

// GET /api/partner/routes — 提携先が自社アプリに組み込むためのルート一覧
export async function GET(req: NextRequest): Promise<NextResponse<ListRoutesResponse>> {
  if (!checkApiKey(req)) {
    return NextResponse.json({ ok: false, routes: [], error: 'APIキーが無効です' }, { status: 401 });
  }
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: true, routes: [] });
  }
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('routes')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, routes: [], error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, routes: data ?? [] });
}
