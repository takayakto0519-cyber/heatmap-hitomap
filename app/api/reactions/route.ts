// /api/reactions : 共感（「いいね」ではなく「わかる／歩いてみたい／懐かしい」の3種タップ）
//   GET    ... trace_ids ごとの種別別反応数 ＋ 自分が付けている種別一覧
//   POST   ... ある種別で反応する（trace_id, reaction_type）
//   DELETE ... ある種別の反応を取り消す（trace_id, reaction_type）
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient, getCurrentUserId } from '@/lib/supabase/requestClient';
import { isReactionType } from '@/lib/reactionTypes';

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('trace_ids');
  if (!idsParam) {
    return NextResponse.json({ ok: false, error: 'trace_ids は必須です' }, { status: 400 });
  }
  const traceIds = idsParam.split(',').filter(Boolean);
  if (traceIds.length === 0) {
    return NextResponse.json({ ok: true, counts: {}, mine: {} });
  }

  const supabase = createRequestClient();
  const { data, error } = await supabase
    .from('trace_reactions')
    .select('trace_id, user_id, reaction_type')
    .in('trace_id', traceIds);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const myId = await getCurrentUserId();
  const counts: Record<string, Record<string, number>> = {};
  const mine: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const forTrace = counts[row.trace_id] ?? (counts[row.trace_id] = {});
    forTrace[row.reaction_type] = (forTrace[row.reaction_type] ?? 0) + 1;
    if (myId && row.user_id === myId) {
      (mine[row.trace_id] ?? (mine[row.trace_id] = [])).push(row.reaction_type);
    }
  }

  return NextResponse.json({ ok: true, counts, mine });
}

export async function POST(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { trace_id?: string; reaction_type?: string };
  if (!body.trace_id) return NextResponse.json({ ok: false, error: 'trace_id は必須です' }, { status: 400 });
  if (!isReactionType(body.reaction_type)) {
    return NextResponse.json({ ok: false, error: 'reaction_type が不正です' }, { status: 400 });
  }

  const supabase = createRequestClient();
  const { error } = await supabase
    .from('trace_reactions')
    .upsert(
      { trace_id: body.trace_id, user_id: myId, reaction_type: body.reaction_type },
      { onConflict: 'trace_id,user_id,reaction_type' }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { trace_id?: string; reaction_type?: string };
  if (!body.trace_id) return NextResponse.json({ ok: false, error: 'trace_id は必須です' }, { status: 400 });
  if (!isReactionType(body.reaction_type)) {
    return NextResponse.json({ ok: false, error: 'reaction_type が不正です' }, { status: 400 });
  }

  const supabase = createRequestClient();
  const { error } = await supabase
    .from('trace_reactions').delete()
    .eq('trace_id', body.trace_id).eq('user_id', myId).eq('reaction_type', body.reaction_type);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
