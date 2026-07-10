// GET /api/follows/suggestions — 「感情が近い人」を提案する。
// 場所の感情共鳴レコメンド（/api/traces/[id]/resonance）と同じロジックを人に転用したもの。
import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import { EMOTIONS } from '@/lib/emotions';

const MIN_TRACES_PER_USER = 3; // 投稿が少なすぎる人は感情構成比が不安定なので除外

interface SuggestedProfile {
  id: string;
  username: string;
  display_name: string | null;
  followersCount: number;
  similarity: number;
  sharedEmotion: string | null;
  sampleTitle: string | null;
}

interface SuggestionsResponse {
  ok: boolean;
  suggestions: SuggestedProfile[];
  error?: string;
}

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

export async function GET(): Promise<NextResponse<SuggestionsResponse>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, suggestions: [], error: 'ログインが必要です' }, { status: 401 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: followRows, error: followError } = await supabaseServer
    .from('follows').select('followee_id').eq('follower_id', userId);
  if (followError) {
    return NextResponse.json({ ok: false, suggestions: [], error: followError.message }, { status: 500 });
  }
  const alreadyFollowing = new Set((followRows ?? []).map((r) => r.followee_id as string));
  alreadyFollowing.add(userId);

  const { data: profiles, error: profileError } = await supabaseServer
    .from('profiles').select('id, username, display_name');
  if (profileError) {
    return NextResponse.json({ ok: false, suggestions: [], error: profileError.message }, { status: 500 });
  }
  const candidateProfiles = (profiles ?? []).filter((p) => !alreadyFollowing.has(p.id));
  if (candidateProfiles.length === 0) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }

  // 感情構成比を作るため、自分＋候補者全員分の投稿を一括取得（本人以外は公開投稿のみが対象）
  const { data: rows, error: tracesError } = await supabaseServer
    .from('traces')
    .select('user_id, emotion_key, title, photo_url, created_at, visibility')
    .eq('is_deleted', false)
    .is('archive_type', null)
    .not('user_id', 'is', null)
    .not('emotion_key', 'is', null);
  if (tracesError) {
    return NextResponse.json({ ok: false, suggestions: [], error: tracesError.message }, { status: 500 });
  }

  interface UserAgg {
    counts: Record<string, number>;
    total: number;
    sample: { title: string; created_at: string } | null;
  }
  const byUser = new Map<string, UserAgg>();
  for (const t of rows ?? []) {
    const uid = t.user_id as string;
    if (uid !== userId && t.visibility !== 'public') continue; // 他人は公開投稿のみ集計
    let agg = byUser.get(uid);
    if (!agg) { agg = { counts: {}, total: 0, sample: null }; byUser.set(uid, agg); }
    agg.counts[t.emotion_key as string] = (agg.counts[t.emotion_key as string] ?? 0) + 1;
    agg.total += 1;
    if (!agg.sample || t.created_at > agg.sample.created_at) {
      agg.sample = { title: t.title as string, created_at: t.created_at as string };
    }
  }

  const myAgg = byUser.get(userId);
  const followerCounts = new Map<string, number>();
  {
    const { data: allFollowRows } = await supabaseServer.from('follows').select('followee_id');
    for (const row of allFollowRows ?? []) {
      const key = row.followee_id as string;
      followerCounts.set(key, (followerCounts.get(key) ?? 0) + 1);
    }
  }

  // 自分の投稿がまだ3件未満（感情構成比が不安定）の場合は、フォロワー数順にフォールバックする
  if (!myAgg || myAgg.total < MIN_TRACES_PER_USER) {
    const suggestions = candidateProfiles
      .map((p) => ({
        id: p.id, username: p.username, display_name: p.display_name,
        followersCount: followerCounts.get(p.id) ?? 0,
        similarity: 0, sharedEmotion: null, sampleTitle: null,
      }))
      .sort((a, b) => b.followersCount - a.followersCount)
      .slice(0, 5);
    return NextResponse.json({ ok: true, suggestions });
  }

  const myVec = toVector(myAgg.counts);
  const myDominant = EMOTIONS.map((e) => ({ e, c: myAgg.counts[e.key] ?? 0 })).sort((a, b) => b.c - a.c)[0]?.e;

  const scored = candidateProfiles
    .map((p) => {
      const agg = byUser.get(p.id);
      if (!agg || agg.total < MIN_TRACES_PER_USER) return null;
      const vec = toVector(agg.counts);
      const similarity = cosineSimilarity(myVec, vec);
      const dominant = EMOTIONS.map((e) => ({ e, c: agg.counts[e.key] ?? 0 })).sort((a, b) => b.c - a.c)[0]?.e;
      const sharedEmotion = dominant?.key === myDominant?.key ? (dominant?.label ?? null) : null;
      return {
        id: p.id, username: p.username, display_name: p.display_name,
        followersCount: followerCounts.get(p.id) ?? 0,
        similarity, sharedEmotion, sampleTitle: agg.sample?.title ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const suggestions = scored
    .sort((a, b) => b.similarity - a.similarity || b.followersCount - a.followersCount)
    .slice(0, 5);

  return NextResponse.json({ ok: true, suggestions });
}
