// GET /api/discover/unexplored?lat=&lng= — 現在地の近くで「開拓余地がある町」を提案する。
// 眠っている痕跡（まだ誰も記録していない、または記録が少ない町）を見つけ出す導線。
import { NextRequest, NextResponse } from 'next/server';
import { haversine } from '@/lib/geo';
import type { Trace } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SEARCH_RADIUS_KM = 50;
const SPARSE_MAX_TRACES = 2; // これ以下の投稿数の町を「眠っている」とみなす
const BLANK_CHECK_RADIUS_KM = 20; // 真っ白な町を探すためのリバースジオコーディング半径
const BLANK_CHECK_DIRECTIONS = [0, 90, 180, 270]; // 東西南北の4方向のみ（Nominatim利用規約を考慮し最小限に）

interface RegionAgg {
  region: string;
  count: number;
  latSum: number;
  lngSum: number;
}

async function reverseGeocodeRegion(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ja&zoom=14`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Hitomap/1.0 (hitomap.info@gmail.com)' } });
    if (!res.ok) return null;
    const data = await res.json() as { address?: Record<string, string> };
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.county;
    if (!city) return null;
    return a.state ? `${a.state}${city}` : city;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: true, sparse: [], blank: [] });

  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: 'lat・lngは必須です' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: rows, error } = await supabaseServer
    .from('traces')
    .select('region, latitude, longitude')
    .eq('is_deleted', false)
    .eq('visibility', 'public')
    .is('archive_type', null)
    .not('region', 'is', null)
    .limit(5000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const byRegion = new Map<string, RegionAgg>();
  for (const t of (rows ?? []) as Pick<Trace, 'region' | 'latitude' | 'longitude'>[]) {
    if (!t.region) continue;
    let agg = byRegion.get(t.region);
    if (!agg) { agg = { region: t.region, count: 0, latSum: 0, lngSum: 0 }; byRegion.set(t.region, agg); }
    agg.count += 1;
    agg.latSum += t.latitude;
    agg.lngSum += t.longitude;
  }

  const knownRegionNames = new Set(byRegion.keys());

  // 眠っている町その1：すでに知っている町の中で、記録がまだ少ない場所
  const sparse = [...byRegion.values()]
    .map((r) => ({
      region: r.region,
      count: r.count,
      distanceKm: Math.round(haversine(lat, lng, r.latSum / r.count, r.lngSum / r.count) / 1000),
    }))
    .filter((r) => r.count <= SPARSE_MAX_TRACES && r.distanceKm <= SEARCH_RADIUS_KM && r.distanceKm > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);

  // 眠っている町その2：まだ誰の痕跡も無い、真っ白な町（東西南北をリバースジオコーディングして確認）
  const blank: { region: string; distanceKm: number; direction: string }[] = [];
  const dirLabels: Record<number, string> = { 0: '北', 90: '東', 180: '南', 270: '西' };
  const degRadius = BLANK_CHECK_RADIUS_KM / 111;
  for (const bearing of BLANK_CHECK_DIRECTIONS) {
    const dLat = bearing === 0 ? degRadius : bearing === 180 ? -degRadius : 0;
    const dLng = bearing === 90 ? degRadius / Math.cos(lat * Math.PI / 180) : bearing === 270 ? -degRadius / Math.cos(lat * Math.PI / 180) : 0;
    const region = await reverseGeocodeRegion(lat + dLat, lng + dLng);
    if (region && !knownRegionNames.has(region) && !blank.some((b) => b.region === region)) {
      blank.push({ region, distanceKm: BLANK_CHECK_RADIUS_KM, direction: dirLabels[bearing] });
    }
    await sleep(600); // Nominatimの利用規約に配慮し、連続リクエストの間隔を空ける
  }

  return NextResponse.json({ ok: true, sparse, blank });
}
