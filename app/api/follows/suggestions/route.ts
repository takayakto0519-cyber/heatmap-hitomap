// GET /api/follows/suggestions — まだフォローしていない人を、フォロワー数の多い順におすすめする
import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';

interface SuggestedProfile {
  id: string;
  username: string;
  display_name: string | null;
  followersCount: number;
}

interface SuggestionsResponse {
  ok: boolean;
  suggestions: SuggestedProfile[];
  error?: string;
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

  const candidates = (profiles ?? []).filter((p) => !alreadyFollowing.has(p.id));
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }

  const { data: allFollowRows } = await supabaseServer.from('follows').select('followee_id');
  const followerCounts = new Map<string, number>();
  for (const row of allFollowRows ?? []) {
    const key = row.followee_id as string;
    followerCounts.set(key, (followerCounts.get(key) ?? 0) + 1);
  }

  const suggestions = candidates
    .map((p) => ({ id: p.id, username: p.username, display_name: p.display_name, followersCount: followerCounts.get(p.id) ?? 0 }))
    .sort((a, b) => b.followersCount - a.followersCount)
    .slice(0, 5);

  return NextResponse.json({ ok: true, suggestions });
}
