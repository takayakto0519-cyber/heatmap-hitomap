// DELETE /api/comments/[id] — 自分のコメントをソフトデリートする
//
// RLSのUPDATE用ポリシー（using/with check双方でauth.uid() = user_id）はis_deleted更新後の
// RETURNING評価の都合で「new row violates row-level security policy」を返し失敗することが
// わかったため、他のオーナー限定操作（/api/traces/[id]のDELETE等）と同じく、
// service roleクライアント + アプリ側での所有者確認に統一する。
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: comment } = await supabaseServer
    .from('trace_comments').select('user_id').eq('id', id).maybeSingle();
  if (!comment) return NextResponse.json({ ok: false, error: 'コメントが見つかりません' }, { status: 404 });
  if (comment.user_id !== myId) return NextResponse.json({ ok: false, error: '自分のコメントのみ削除できます' }, { status: 403 });

  const { error } = await supabaseServer
    .from('trace_comments')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
