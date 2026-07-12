// GET /api/admin/profiles — 登録ユーザー一覧（投稿数・最終投稿日つき、合言葉必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');

  const [{ data: profiles, error: profileError }, { data: traces, error: traceError }, { data: follows }] = await Promise.all([
    supabaseServer.from('profiles').select('id, username, display_name, bio, avatar_url, created_at'),
    supabaseServer.from('traces').select('user_id, created_at').eq('is_deleted', false).not('user_id', 'is', null),
    supabaseServer.from('follows').select('follower_id, followee_id'),
  ]);

  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  if (traceError) return NextResponse.json({ ok: false, error: traceError.message }, { status: 500 });

  const traceStats = new Map<string, { count: number; lastPostedAt: string }>();
  for (const t of (traces ?? []) as { user_id: string; created_at: string }[]) {
    const cur = traceStats.get(t.user_id);
    if (!cur) traceStats.set(t.user_id, { count: 1, lastPostedAt: t.created_at });
    else {
      cur.count += 1;
      if (t.created_at > cur.lastPostedAt) cur.lastPostedAt = t.created_at;
    }
  }

  const followerCounts = new Map<string, number>();
  const followingCounts = new Map<string, number>();
  for (const f of (follows ?? []) as { follower_id: string; followee_id: string }[]) {
    followerCounts.set(f.followee_id, (followerCounts.get(f.followee_id) ?? 0) + 1);
    followingCounts.set(f.follower_id, (followingCounts.get(f.follower_id) ?? 0) + 1);
  }

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    bio: p.bio,
    avatar_url: p.avatar_url,
    created_at: p.created_at,
    traceCount: traceStats.get(p.id)?.count ?? 0,
    lastPostedAt: traceStats.get(p.id)?.lastPostedAt ?? null,
    followerCount: followerCounts.get(p.id) ?? 0,
    followingCount: followingCounts.get(p.id) ?? 0,
  })).sort((a, b) => b.traceCount - a.traceCount);

  return NextResponse.json({ ok: true, users });
}
