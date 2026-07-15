// GET /api/stats/public — トップページの実績表示用の公開統計。
// 数字を捏造しないためにDBの実数だけを返す（全国公開済み・未削除の投稿数と、歩かれた町の数）。
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, traces: 0, regions: 0 });
  }
  try {
    const { supabaseServer } = await import('@/lib/supabase/server');
    const [{ count: traceCount }, { data: regionRows }] = await Promise.all([
      supabaseServer
        .from('traces')
        .select('id', { count: 'exact', head: true })
        .eq('visibility', 'public')
        .eq('is_deleted', false),
      supabaseServer
        .from('traces')
        .select('region')
        .eq('visibility', 'public')
        .eq('is_deleted', false)
        .not('region', 'is', null)
        .limit(2000),
    ]);
    const regions = new Set((regionRows ?? []).map(r => r.region).filter(Boolean)).size;
    return NextResponse.json({ ok: true, traces: traceCount ?? 0, regions });
  } catch {
    return NextResponse.json({ ok: true, traces: 0, regions: 0 });
  }
}
