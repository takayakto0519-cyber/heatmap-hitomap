// /api/messages
//   GET  ... 自分の会話一覧（相手ごとに最新メッセージ・未読数）
//   POST { recipient_id, body } ... メッセージ送信（相互フォローの相手のみ）
//
// direct_messages のRLSはSELECTのみ（当事者本人）許可。書き込みは相互フォロー確認という
// アプリ側ロジックが必須なため、他のオーナー限定操作と同じくservice-role + 明示チェックに統一する。
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import { isMutualFollow } from '@/lib/mutualFollow';
import { notifyDiscordError } from '@/lib/discord';
import type { DmConversation, DirectMessage } from '@/lib/types';

export async function GET() {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, conversations: [], error: 'ログインが必要です' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: rows, error } = await supabaseServer
    .from('direct_messages')
    .select('id, created_at, sender_id, recipient_id, body, read_at')
    .eq('is_deleted', false)
    .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
    .order('created_at', { ascending: false });

  if (error) {
    notifyDiscordError('GET /api/messages', error);
    return NextResponse.json({ ok: false, conversations: [], error: error.message }, { status: 500 });
  }

  const byOther = new Map<string, { last: DirectMessage; unread: number }>();
  for (const m of (rows ?? []) as DirectMessage[]) {
    const otherId = m.sender_id === myId ? m.recipient_id : m.sender_id;
    const entry = byOther.get(otherId);
    const isUnreadForMe = m.recipient_id === myId && !m.read_at;
    if (!entry) {
      byOther.set(otherId, { last: m, unread: isUnreadForMe ? 1 : 0 });
    } else if (isUnreadForMe) {
      entry.unread += 1;
    }
  }

  const otherIds = [...byOther.keys()];
  if (otherIds.length === 0) return NextResponse.json({ ok: true, conversations: [] });

  const { data: profiles } = await supabaseServer
    .from('profiles').select('id, username, display_name, avatar_url').in('id', otherIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const conversations: DmConversation[] = otherIds
    .map((otherId) => {
      const p = profileMap.get(otherId);
      const entry = byOther.get(otherId)!;
      if (!p) return null;
      return {
        userId: otherId,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        lastMessage: entry.last.body,
        lastMessageAt: entry.last.created_at,
        lastSenderId: entry.last.sender_id,
        unreadCount: entry.unread,
      };
    })
    .filter((c): c is DmConversation => c !== null)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  return NextResponse.json({ ok: true, conversations });
}

export async function POST(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { recipient_id?: string; body?: string };
  const recipientId = body.recipient_id;
  const text = body.body?.trim();
  if (!recipientId) return NextResponse.json({ ok: false, error: 'recipient_id は必須です' }, { status: 400 });
  if (!text) return NextResponse.json({ ok: false, error: '本文を入力してください' }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ ok: false, error: '本文が長すぎます（1000文字まで）' }, { status: 400 });
  if (recipientId === myId) return NextResponse.json({ ok: false, error: '自分にはメッセージを送れません' }, { status: 400 });

  const mutual = await isMutualFollow(myId, recipientId);
  if (!mutual) {
    return NextResponse.json({ ok: false, error: 'お互いにフォローしている相手にのみメッセージを送れます' }, { status: 403 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('direct_messages')
    .insert({ sender_id: myId, recipient_id: recipientId, body: text })
    .select().single();

  if (error) {
    notifyDiscordError('POST /api/messages', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: data });
}
