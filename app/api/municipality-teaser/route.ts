// GET /api/municipality-teaser?region=... — 公開ページ用の軽量エンドポイント。
// 「この自治体は人口統計との比較分析が用意できます」という有無だけを返す（実際の数値は返さない）。
// 昼夜間人口比率などの実データは有料の顧客専用ダッシュボード（/dashboard/[token]）だけの機能とし、
// 一般公開ページとの間で無料/有料の境界を明確に保つ。認証不要（真偽値1つだけの低感度情報のため）。
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: true, hasPopulationStats: false });

  const region = req.nextUrl.searchParams.get('region');
  if (!region) return NextResponse.json({ ok: false, error: 'regionは必須です' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data } = await supabaseServer
    .from('municipality_profiles')
    .select('population_stats')
    .eq('region_name', region)
    .maybeSingle();

  const hasPopulationStats = Boolean((data as { population_stats?: unknown } | null)?.population_stats);
  return NextResponse.json({ ok: true, hasPopulationStats });
}
