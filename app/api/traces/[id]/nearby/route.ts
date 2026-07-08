// GET /api/traces/[id]/nearby?radius=25 — 同一地点（半径内）の他の投稿を時系列順で返す（重ね書き表示用）
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import { haversine } from '@/lib/geo';
import type { Trace } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const DEFAULT_RADIUS = 25; // メートル。GPS誤差（5〜15m程度）を考慮し20mよりやや広めに設定

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  const { id } = context.params;
  const radius = Number(req.nextUrl.searchParams.get('radius') ?? DEFAULT_RADIUS);

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: target } = await supabaseServer
    .from('traces').select('id, latitude, longitude').eq('id', id).single();
  if (!target) return NextResponse.json({ ok: false, error: '投稿が見つかりません' }, { status: 404 });

  // 緯度1度 ≒ 111km。半径から緯度経度のバウンディングボックスを概算して事前絞り込みする
  const degRadius = (radius / 111000) * 1.5;
  const myId = await getCurrentUserId();

  let query = supabaseServer
    .from('traces')
    .select('*')
    .eq('is_deleted', false)
    .neq('id', id)
    .gte('latitude', target.latitude - degRadius)
    .lte('latitude', target.latitude + degRadius)
    .gte('longitude', target.longitude - degRadius)
    .lte('longitude', target.longitude + degRadius);

  if (!myId) {
    query = query.eq('visibility', 'public');
  } else {
    const { data: followRows } = await supabaseServer
      .from('follows').select('followee_id').eq('follower_id', myId);
    const followingIds = (followRows ?? []).map((r) => r.followee_id);
    const orParts = ['visibility.eq.public', `user_id.eq.${myId}`];
    if (followingIds.length > 0) {
      orParts.push(`and(visibility.eq.followers,user_id.in.(${followingIds.join(',')}))`);
    }
    query = query.or(orParts.join(','));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const traces = ((data ?? []) as Trace[])
    .filter((t) => haversine(target.latitude, target.longitude, t.latitude, t.longitude) <= radius)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return NextResponse.json({ ok: true, traces, count: traces.length });
}
