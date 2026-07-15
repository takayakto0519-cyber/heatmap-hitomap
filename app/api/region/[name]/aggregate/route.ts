// ============================================================
// /api/region/[name]/aggregate : 自治体向け集計レイヤー（Phase 1）
//
// 目的：個別トレース（緯度経度・写真・自由記述）を一切見せず、
// グリッド単位の件数・感情内訳だけを返す。件数がしきい値未満のセルは
// 抑制（非表示）し、少数の投稿から個人の行動を推定できないようにする。
//
// 集計ロジック本体は lib/regionAggregate.ts に切り出してあり、
// 顧客専用トークン経由の /api/dashboard/[token]（Phase 2）とも共有する。
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { computeRegionAggregate, clampGridSizeDeg, clampThreshold, DEFAULT_GRID_SIZE_DEG, DEFAULT_THRESHOLD } from '@/lib/regionAggregate';
import type { RegionAggregateResponse } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const region = decodeURIComponent(params.name);

  if (!SUPABASE_READY) {
    return NextResponse.json<RegionAggregateResponse>({
      ok: true,
      region,
      generatedAt: new Date().toISOString(),
      gridSizeDeg: DEFAULT_GRID_SIZE_DEG,
      threshold: DEFAULT_THRESHOLD,
      totalPublicTraces: 0,
      suppressedCells: 0,
      cells: [],
    });
  }

  const gridSizeDeg = clampGridSizeDeg(Number(req.nextUrl.searchParams.get('gridSizeDeg')));
  const threshold = clampThreshold(Number(req.nextUrl.searchParams.get('threshold')));

  const { supabaseServer } = await import('@/lib/supabase/server');
  const result = await computeRegionAggregate(supabaseServer, region, gridSizeDeg, threshold);

  return NextResponse.json<RegionAggregateResponse>(result, { status: result.ok ? 200 : 500 });
}
