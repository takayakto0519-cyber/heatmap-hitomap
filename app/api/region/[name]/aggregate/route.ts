// ============================================================
// /api/region/[name]/aggregate : 自治体向け集計レイヤー（Phase 1）
//
// 目的：個別トレース（緯度経度・写真・自由記述）を一切見せず、
// グリッド単位の件数・感情内訳だけを返す。件数がしきい値未満のセルは
// 抑制（非表示）し、少数の投稿から個人の行動を推定できないようにする。
//
// 既存の lib/leadEvidence.ts（地域全体の1つの集計値）とは違い、
// こちらは空間的なグリッドに分けて返す点が新しい。将来の顧客向け
// ダッシュボード（Phase 2）は、このレイヤーの上にテナント認証を
// 被せる形で作る想定。
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { summarizeValence } from '@/lib/emotions';
import type { RegionAggregateCell, RegionAggregateResponse } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const DEFAULT_GRID_SIZE_DEG = 0.01; // 目安で約1km四方
const DEFAULT_THRESHOLD = 5;        // このしきい値未満の件数のセルは表示しない
const MAX_GRID_SIZE_DEG = 0.2;
const MIN_GRID_SIZE_DEG = 0.001;
const MAX_THRESHOLD = 50;

function roundToGrid(value: number, gridSizeDeg: number): number {
  return Math.round(value / gridSizeDeg) * gridSizeDeg;
}

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json<RegionAggregateResponse>({
      ok: true,
      region: params.name,
      generatedAt: new Date().toISOString(),
      gridSizeDeg: DEFAULT_GRID_SIZE_DEG,
      threshold: DEFAULT_THRESHOLD,
      totalPublicTraces: 0,
      suppressedCells: 0,
      cells: [],
    });
  }

  const region = decodeURIComponent(params.name);

  const gridSizeDegParam = Number(req.nextUrl.searchParams.get('gridSizeDeg'));
  const gridSizeDeg =
    Number.isFinite(gridSizeDegParam) && gridSizeDegParam >= MIN_GRID_SIZE_DEG && gridSizeDegParam <= MAX_GRID_SIZE_DEG
      ? gridSizeDegParam
      : DEFAULT_GRID_SIZE_DEG;

  const thresholdParam = Number(req.nextUrl.searchParams.get('threshold'));
  const threshold =
    Number.isInteger(thresholdParam) && thresholdParam >= 1 && thresholdParam <= MAX_THRESHOLD
      ? thresholdParam
      : DEFAULT_THRESHOLD;

  const { supabaseServer } = await import('@/lib/supabase/server');

  // 集計にのみ使う列を明示的に選択する。title/why/interpretation/photo_url等は
  // 一切 select しない（顧客向けレイヤーで個別の生データが漏れる経路を作らないため）。
  const { data, error } = await supabaseServer
    .from('traces')
    .select('latitude, longitude, emotion_key')
    .eq('is_deleted', false)
    .eq('visibility', 'public')
    .eq('region', region);

  if (error) {
    return NextResponse.json<RegionAggregateResponse>(
      {
        ok: false,
        region,
        generatedAt: new Date().toISOString(),
        gridSizeDeg,
        threshold,
        totalPublicTraces: 0,
        suppressedCells: 0,
        cells: [],
        error: error.message,
      },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as { latitude: number; longitude: number; emotion_key: string | null }[];

  const buckets = new Map<string, { gridLat: number; gridLng: number; emotionKeys: (string | null)[] }>();
  for (const row of rows) {
    if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') continue;
    const gridLat = roundToGrid(row.latitude, gridSizeDeg);
    const gridLng = roundToGrid(row.longitude, gridSizeDeg);
    const key = `${gridLat.toFixed(6)}:${gridLng.toFixed(6)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.emotionKeys.push(row.emotion_key);
    } else {
      buckets.set(key, { gridLat, gridLng, emotionKeys: [row.emotion_key] });
    }
  }

  let suppressedCells = 0;
  const cells: RegionAggregateCell[] = [];
  for (const bucket of buckets.values()) {
    const count = bucket.emotionKeys.length;
    if (count < threshold) {
      suppressedCells++;
      continue;
    }
    cells.push({
      gridLat: bucket.gridLat,
      gridLng: bucket.gridLng,
      count,
      valence: summarizeValence(bucket.emotionKeys),
    });
  }

  cells.sort((a, b) => b.count - a.count);

  return NextResponse.json<RegionAggregateResponse>({
    ok: true,
    region,
    generatedAt: new Date().toISOString(),
    gridSizeDeg,
    threshold,
    totalPublicTraces: rows.length,
    suppressedCells,
    cells,
  });
}
