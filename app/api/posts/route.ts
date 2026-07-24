// GET /api/posts — 公開済みの実績記事一覧（公開ページ用）
//   ?ids=id1,id2 — トップページの写真グリュード等、特定記事だけをID指定で取得する場合に使う
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, posts: [] });
  }
  const idsParam = req.nextUrl.searchParams.get('ids');
  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer
    .from('site_posts')
    .select('id, slug, title, category, event_date, body, cover_url, photo_urls, testimonials, is_published, created_at, updated_at')
    .eq('is_published', true);

  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50);
    query = query.in('id', ids);
  } else {
    query = query.order('event_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(50);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message, posts: [] }, { status: 500 });

  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    const byId = new Map((data ?? []).map(p => [p.id, p]));
    const ordered = ids.map(id => byId.get(id)).filter(Boolean);
    return NextResponse.json({ ok: true, posts: ordered });
  }
  return NextResponse.json({ ok: true, posts: data ?? [] });
}
