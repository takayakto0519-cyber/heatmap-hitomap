// DELETE /api/admin/comments/[id] — 運営がコメントをソフトデリートする（通報対応・荒らし対策）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });

  const { id } = context.params;
  const { supabaseServer } = await import('@/lib/supabase/server');
  const { error } = await supabaseServer
    .from('trace_comments')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
