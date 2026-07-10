// GET /api/traces/[id]/resonance — 「感情が近い／遠い町」を提案する発見導線。
// 町（region）ごとの感情構成比ベクトルを作り、コサイン類似度で比較する。
import { NextRequest, NextResponse } from 'next/server';
import { EMOTIONS } from '@/lib/emotions';
import { haversine } from '@/lib/geo';
import type { Trace } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const MIN_TRACES_PER_REGION = 3; // これ未満の町は感情構成比が不安定なので候補から除外
const CANDIDATES_PER_SIDE = 3;

type Vector = number[];

function toVector(counts: Record<string, number>): Vector {
  const total = EMOTIONS.reduce((s, e) => s + (counts[e.key] ?? 0), 0);
  if (total === 0) return EMOTIONS.map(() => 0);
  return EMOTIONS.map((e) => (counts[e.key] ?? 0) / total);
}

function cosineSimilarity(a: Vector, b: Vector): number {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

interface RegionAgg {
  region: string;
  counts: Record<string, number>;
  total: number;
  latSum: number;
  lngSum: number;
  representative: Trace | null; // 写真つき・直近を優先
}

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: target } = await supabaseServer
    .from('traces').select('*').eq('id', id).single();
  if (!target || !target.region || !target.emotion_key) {
    return NextResponse.json({ ok: true, similar: [], distant: [] });
  }

  const { data: rows, error } = await supabaseServer
    .from('traces')
    .select('id, title, photo_url, region, emotion_key, latitude, longitude, created_at, why, intensity')
    .eq('is_deleted', false)
    .eq('visibility', 'public')
    .is('archive_type', null)
    .not('region', 'is', null)
    .not('emotion_key', 'is', null)
    .limit(3000);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const byRegion = new Map<string, RegionAgg>();
  for (const t of (rows ?? []) as Trace[]) {
    if (!t.region || !t.emotion_key) continue;
    let agg = byRegion.get(t.region);
    if (!agg) {
      agg = { region: t.region, counts: {}, total: 0, latSum: 0, lngSum: 0, representative: null };
      byRegion.set(t.region, agg);
    }
    agg.counts[t.emotion_key] = (agg.counts[t.emotion_key] ?? 0) + 1;
    agg.total += 1;
    agg.latSum += t.latitude;
    agg.lngSum += t.longitude;
    if (!agg.representative || (t.photo_url && !agg.representative.photo_url) || t.created_at > agg.representative.created_at) {
      agg.representative = t;
    }
  }

  const targetAgg = byRegion.get(target.region);
  if (!targetAgg) return NextResponse.json({ ok: true, similar: [], distant: [] });
  const targetVec = toVector(targetAgg.counts);
  const targetLat = targetAgg.latSum / targetAgg.total;
  const targetLng = targetAgg.lngSum / targetAgg.total;

  const scored = [...byRegion.values()]
    .filter((r) => r.region !== target.region && r.total >= MIN_TRACES_PER_REGION)
    .map((r) => {
      const vec = toVector(r.counts);
      const similarity = cosineSimilarity(targetVec, vec);
      const distanceKm = haversine(targetLat, targetLng, r.latSum / r.total, r.lngSum / r.total) / 1000;
      const dominant = EMOTIONS.map((e) => ({ e, c: r.counts[e.key] ?? 0 })).sort((a, b) => b.c - a.c)[0]?.e;
      return {
        region: r.region,
        similarity,
        distanceKm: Math.round(distanceKm),
        dominantEmotion: dominant?.key ?? null,
        sampleTrace: r.representative
          ? { id: r.representative.id, title: r.representative.title, photo_url: r.representative.photo_url, why: r.representative.why }
          : null,
      };
    });

  const similar = [...scored].sort((a, b) => b.similarity - a.similarity).slice(0, CANDIDATES_PER_SIDE);
  const distant = [...scored].sort((a, b) => a.similarity - b.similarity).slice(0, CANDIDATES_PER_SIDE);

  return NextResponse.json({ ok: true, similar, distant });
}
