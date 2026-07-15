// ============================================================
// 地域単位のグリッド集計（自治体向けダッシュボードの共通基盤）
//
// app/api/region/[name]/aggregate（Phase 1・一般公開）と
// app/api/dashboard/[token]（Phase 2・顧客専用トークン経由）の
// 両方から呼ばれる。個別トレースの座標・写真・自由記述は
// 呼び出し元に一切渡さない。
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeValence } from '@/lib/emotions';
import type { RegionAggregateCell, RegionAggregateResponse } from '@/lib/types';

export const DEFAULT_GRID_SIZE_DEG = 0.01; // 目安で約1km四方
export const DEFAULT_THRESHOLD = 5;        // このしきい値未満の件数のセルは表示しない
export const MAX_GRID_SIZE_DEG = 0.2;
export const MIN_GRID_SIZE_DEG = 0.001;
export const MAX_THRESHOLD = 50;

export function clampGridSizeDeg(value: number): number {
  return Number.isFinite(value) && value >= MIN_GRID_SIZE_DEG && value <= MAX_GRID_SIZE_DEG
    ? value
    : DEFAULT_GRID_SIZE_DEG;
}

export function clampThreshold(value: number): number {
  return Number.isInteger(value) && value >= 1 && value <= MAX_THRESHOLD ? value : DEFAULT_THRESHOLD;
}

function roundToGrid(value: number, gridSizeDeg: number): number {
  return Math.round(value / gridSizeDeg) * gridSizeDeg;
}

export async function computeRegionAggregate(
  supabaseServer: SupabaseClient,
  region: string,
  gridSizeDeg: number = DEFAULT_GRID_SIZE_DEG,
  threshold: number = DEFAULT_THRESHOLD
): Promise<RegionAggregateResponse> {
  // 集計にのみ使う列を明示的に選択する。title/why/interpretation/photo_url等は
  // 一切 select しない（顧客向けレイヤーで個別の生データが漏れる経路を作らないため）。
  const { data, error } = await supabaseServer
    .from('traces')
    .select('latitude, longitude, emotion_key')
    .eq('is_deleted', false)
    .eq('visibility', 'public')
    .eq('region', region);

  if (error) {
    return {
      ok: false,
      region,
      generatedAt: new Date().toISOString(),
      gridSizeDeg,
      threshold,
      totalPublicTraces: 0,
      suppressedCells: 0,
      cells: [],
      error: error.message,
    };
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

  return {
    ok: true,
    region,
    generatedAt: new Date().toISOString(),
    gridSizeDeg,
    threshold,
    totalPublicTraces: rows.length,
    suppressedCells,
    cells,
  };
}
