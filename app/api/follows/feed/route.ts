// GET /api/follows/feed — フォロー中ユーザーの最近の投稿（つながりの可視化）
import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import type { Trace } from '@/lib/types';

interface FeedProfile {
  id: string;
  username: string;
  display_name: string | null;
}

interface FollowFeedResponse {
  ok: boolean;
  traces: Trace[];
  profiles: FeedProfile[];
  error?: string;
}

export async function GET(): Promise<NextResponse<FollowFeedResponse>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, traces: [], profiles: [], error: 'ログインが必要です' }, { status: 401 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: followRows, error: followError } = await supabaseServer
    .from('follows').select('followee_id').eq('follower_id', userId);
  if (followError) {
    return NextResponse.json({ ok: false, traces: [], profiles: [], error: followError.message }, { status: 500 });
  }

  const followingIds = (followRows ?? []).map((r) => r.followee_id as string);
  if (followingIds.length === 0) {
    return NextResponse.json({ ok: true, traces: [], profiles: [] });
  }

  const { data: traces, error: traceError } = await supabaseServer
    .from('traces')
    .select('*')
    .eq('is_deleted', false)
    .in('user_id', followingIds)
    .or('visibility.eq.public,visibility.eq.followers')
    .order('created_at', { ascending: false })
    .limit(100);

  if (traceError) {
    return NextResponse.json({ ok: false, traces: [], profiles: [], error: traceError.message }, { status: 500 });
  }

  const { data: profiles } = await supabaseServer
    .from('profiles').select('id, username, display_name').in('id', followingIds);

  return NextResponse.json({ ok: true, traces: (traces ?? []) as Trace[], profiles: (profiles ?? []) as FeedProfile[] });
}
