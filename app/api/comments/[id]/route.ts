// DELETE /api/comments/[id] — 自分のコメントをソフトデリートする
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient, getCurrentUserId } from '@/lib/supabase/requestClient';

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const { id } = context.params;
  const supabase = createRequestClient();
  // RLSのupdateポリシー(auth.uid() = user_id)により、他人のコメントはそもそも更新できない
  const { error } = await supabase
    .from('trace_comments')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', myId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
