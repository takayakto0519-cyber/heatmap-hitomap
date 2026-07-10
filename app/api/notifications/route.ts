// /api/notifications : すれ違い通知など
//   GET   ... 自分あての通知一覧（未読が先）
//   PATCH { id } または { all: true } ... 既読にする
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';

// notifications テーブルはRLS有効・ポリシー未設定のため、service-roleクライアントを使い
// アプリ側で user_id = 自分 のみに絞ることで安全性を担保する（bookmarks等とは異なる方式）
export async function GET() {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, notifications: [], unreadCount: 0, error: 'ログインが必要です' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('notifications')
    .select('id, type, trace_id, actor_trace_id, message, is_read, created_at')
    .eq('user_id', myId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, notifications: [], unreadCount: 0, error: error.message }, { status: 500 });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  return NextResponse.json({ ok: true, notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { id?: string; all?: boolean };
  const { supabaseServer } = await import('@/lib/supabase/server');

  if (body.all) {
    const { error } = await supabaseServer.from('notifications').update({ is_read: true }).eq('user_id', myId).eq('is_read', false);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ ok: false, error: 'id または all は必須です' }, { status: 400 });
  const { error } = await supabaseServer.from('notifications').update({ is_read: true }).eq('id', body.id).eq('user_id', myId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
