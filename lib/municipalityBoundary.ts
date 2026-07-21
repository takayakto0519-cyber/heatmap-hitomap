// 市区町村の行政区域境界（GeoJSON）を読むためのヘルパー。
// データは scripts/fetch-municipality-boundaries.mjs が data/municipality-boundaries/ に
// 都道府県ごとのFeatureCollectionとして保存済み（出典: 国土数値情報 行政区域データ N03、
// smartnews-smri/japan-topography経由）。
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MapBbox, BoundaryGeometry } from '@/lib/types';

export interface MunicipalityBoundary {
  name: string;
  geometry: BoundaryGeometry;
}

const DATA_DIR = path.join(process.cwd(), 'data', 'municipality-boundaries');

// code: 全国地方公共団体コード5桁（例: '09204' = 佐野市）
export async function getMunicipalityBoundary(code: string): Promise<MunicipalityBoundary | null> {
  const prefCode = code.slice(0, 2);
  let text: string;
  try {
    text = await readFile(path.join(DATA_DIR, `${prefCode}.json`), 'utf-8');
  } catch {
    return null; // 境界データ未取得（fetch-municipality-boundaries.mjs未実行）
  }

  const geojson = JSON.parse(text) as { features: { properties: Record<string, string | null>; geometry: BoundaryGeometry }[] };
  const feature = geojson.features.find((f) => f.properties.N03_007 === code);
  if (!feature) return null;

  const name = feature.properties.N03_005
    ? `${feature.properties.N03_004}${feature.properties.N03_005}`
    : (feature.properties.N03_004 ?? '');

  return { name, geometry: feature.geometry };
}

// ポリゴン座標([lng, lat]の入れ子配列)を1回走査し、min/maxの緯度経度を出す。
// turf等のライブラリは使わず、lib/regionAggregate.tsと同じ「必要最小限の自前実装」の流儀に揃える。
export function bboxFromGeometry(geometry: BoundaryGeometry): MapBbox {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

  const rings: number[][][] = geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : geometry.coordinates;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}
