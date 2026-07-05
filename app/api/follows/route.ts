import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient, getCurrentUserId } from '@/lib/supabase/requestClient';

// GET /api/follows?user_id=xxx — そのユーザーのフォロー中/フォロワー一覧＋自分がフォロー済みか
export async function GET(req: NextRequest) {
  const targetId = req.nextUrl.searchParams.get('user_id');
  if (!targetId) {
    return NextResponse.json({ ok: false, error: 'user_id は必須です' }, { status: 400 });
  }
  const supabase = createRequestClient();
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from('follows').select('followee_id').eq('follower_id', targetId),
    supabase.from('follows').select('follower_id').eq('followee_id', targetId),
  ]);

  const myId = await getCurrentUserId();
  let isFollowing = false;
  if (myId) {
    const { data } = await supabase
      .from('follows').select('follower_id').eq('follower_id', myId).eq('followee_id', targetId).maybeSingle();
    isFollowing = Boolean(data);
  }

  return NextResponse.json({
    ok: true,
    followingCount: following?.length ?? 0,
    followersCount: followers?.length ?? 0,
    isFollowing,
  });
}

// POST /api/follows { followee_id } — フォローする
export async function POST(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { followee_id?: string };
  if (!body.followee_id) return NextResponse.json({ ok: false, error: 'followee_id は必須です' }, { status: 400 });
  if (body.followee_id === myId) return NextResponse.json({ ok: false, error: '自分自身はフォローできません' }, { status: 400 });
  const supabase = createRequestClient();
  const { error } = await supabase.from('follows').insert({ follower_id: myId, followee_id: body.followee_id });
  if (error && error.code !== '23505') return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/follows { followee_id } — フォロー解除
export async function DELETE(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { followee_id?: string };
  if (!body.followee_id) return NextResponse.json({ ok: false, error: 'followee_id は必須です' }, { status: 400 });
  const supabase = createRequestClient();
  const { error } = await supabase.from('follows').delete()
    .eq('follower_id', myId).eq('followee_id', body.followee_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
