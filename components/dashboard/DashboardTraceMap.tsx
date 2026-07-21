'use client';

// 自治体向けダッシュボード専用の地図。境界ポリゴンで自治体の外側をマスクし、
// 外へパンできないようにした上で、集計済みグリッドセル（個別座標ではない）からヒートを描く。
// TraceMapはLeafletを使うためSSRできず、dynamic importでクライアント側のみで読み込む。
import dynamic from 'next/dynamic';
import type { BoundaryGeometry, MapBbox } from '@/lib/types';
import { getDayNightRatioColor, getDayNightRatioOpacity } from '@/lib/estat';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa', fontSize: 12 }}>
      地図を読み込み中…
    </div>
  ),
});

// bboxの外周に少し余白を持たせてmaxBoundsにする（境界ぎりぎりで窮屈にならないように）
function maxBoundsFromBbox(bbox: MapBbox, paddingDeg = 0.01): [[number, number], [number, number]] {
  return [
    [bbox.minLat - paddingDeg, bbox.minLng - paddingDeg],
    [bbox.maxLat + paddingDeg, bbox.maxLng + paddingDeg],
  ];
}

export default function DashboardTraceMap({
  aggregateCells,
  boundaryGeoJson,
  bbox,
  dayNightRatio,
}: {
  aggregateCells: { gridLat: number; gridLng: number; count: number }[];
  boundaryGeoJson: BoundaryGeometry;
  bbox: MapBbox;
  // 人口統計の比較レイヤー（取得済みの場合のみ）。有料ダッシュボード専用機能。
  dayNightRatio?: number | null;
}) {
  const populationFill = dayNightRatio != null
    ? { color: getDayNightRatioColor(dayNightRatio), opacity: getDayNightRatioOpacity(dayNightRatio) }
    : null;
  return (
    <TraceMap
      traces={[]}
      mode="heat"
      aggregateCells={aggregateCells}
      boundaryGeoJson={boundaryGeoJson}
      populationFill={populationFill}
      maxBounds={maxBoundsFromBbox(bbox)}
      fitBounds={[[bbox.minLat, bbox.minLng], [bbox.maxLat, bbox.maxLng]]}
      allowWideZoom
    />
  );
}
