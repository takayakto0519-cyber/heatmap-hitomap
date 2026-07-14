// /api/comment-reactions : コメントへの「いいね」
//   GET    ... comment_ids ごとのいいね数 ＋ 自分がいいね済みの comment_id 一覧
//   POST   ... いいねする（comment_id）
//   DELETE ... いいねを取り消す（comment_id）
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient, getCurrentUserId } from '@/lib/supabase/requestClient';

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('comment_ids');
  if (!idsParam) {
    return NextResponse.json({ ok: false, error: 'comment_ids は必須です' }, { status: 400 });
  }
  const commentIds = idsParam.split(',').filter(Boolean);
  if (commentIds.length === 0) {
    return NextResponse.json({ ok: true, counts: {}, mine: [] });
  }

  const supabase = createRequestClient();
  const { data, error } = await supabase
    .from('comment_reactions')
    .select('comment_id, user_id')
    .in('comment_id', commentIds);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const myId = await getCurrentUserId();
  const counts: Record<string, number> = {};
  const mine: string[] = [];
  for (const row of data ?? []) {
    counts[row.comment_id] = (counts[row.comment_id] ?? 0) + 1;
    if (myId && row.user_id === myId) mine.push(row.comment_id);
  }

  return NextResponse.json({ ok: true, counts, mine });
}

export async function POST(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { comment_id?: string };
  if (!body.comment_id) return NextResponse.json({ ok: false, error: 'comment_id は必須です' }, { status: 400 });

  const supabase = createRequestClient();
  const { error } = await supabase
    .from('comment_reactions')
    .upsert(
      { comment_id: body.comment_id, user_id: myId, reaction_type: 'like' },
      { onConflict: 'comment_id,user_id,reaction_type' }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { comment_id?: string };
  if (!body.comment_id) return NextResponse.json({ ok: false, error: 'comment_id は必須です' }, { status: 400 });

  const supabase = createRequestClient();
  const { error } = await supabase
    .from('comment_reactions').delete()
    .eq('comment_id', body.comment_id).eq('user_id', myId).eq('reaction_type', 'like');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
