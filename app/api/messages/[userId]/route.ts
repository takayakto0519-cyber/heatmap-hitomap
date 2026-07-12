// /api/messages/[userId]
//   GET ... 自分と相手とのスレッド取得（相手からの未読は既読にする）。相互フォローでなくても
//           過去のやり取りは見られるが、isMutualがfalseの場合はUI側で送信フォームを隠す。
import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import { isMutualFollow } from '@/lib/mutualFollow';
import { notifyDiscordError } from '@/lib/discord';

export async function GET(_req: Request, context: { params: { userId: string } }) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, messages: [], isMutual: false, error: 'ログインが必要です' }, { status: 401 });

  const otherId = context.params.userId;
  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: messages, error } = await supabaseServer
    .from('direct_messages')
    .select('id, created_at, sender_id, recipient_id, body, read_at')
    .eq('is_deleted', false)
    .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    notifyDiscordError('GET /api/messages/[userId]', error);
    return NextResponse.json({ ok: false, messages: [], isMutual: false, error: error.message }, { status: 500 });
  }

  const unreadIds = (messages ?? [])
    .filter((m) => m.recipient_id === myId && !m.read_at)
    .map((m) => m.id);
  if (unreadIds.length > 0) {
    await supabaseServer.from('direct_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
  }

  const isMutual = await isMutualFollow(myId, otherId);

  return NextResponse.json({ ok: true, messages: messages ?? [], isMutual });
}
