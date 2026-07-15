// GET /api/blocks?page=home — 公開中のサイトブロック一覧（表示ページ用）
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get('page') ?? 'home';
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, blocks: [] });
  }
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('site_blocks')
    .select('*')
    .eq('page', page)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message, blocks: [] }, { status: 500 });
  return NextResponse.json({ ok: true, blocks: data ?? [] });
}
