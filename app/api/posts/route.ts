// GET /api/posts — 公開済みの実績記事一覧（公開ページ用）
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, posts: [] });
  }
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('site_posts')
    .select('id, slug, title, category, event_date, body, cover_url, photo_urls, testimonials, is_published, created_at, updated_at')
    .eq('is_published', true)
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message, posts: [] }, { status: 500 });
  return NextResponse.json({ ok: true, posts: data ?? [] });
}
