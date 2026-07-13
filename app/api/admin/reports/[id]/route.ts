import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// PATCH /api/admin/reports/[id] — 通報の処理（却下 / 投稿を削除の二択、パスワード必須）
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as { action?: 'dismiss' | 'action' };
  if (body.action !== 'dismiss' && body.action !== 'action') {
    return NextResponse.json({ ok: false, error: 'action は dismiss または action です' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: report, error: fetchError } = await supabaseServer
    .from('trace_reports').select('trace_id').eq('id', id).single();
  if (fetchError || !report) return NextResponse.json({ ok: false, error: '通報が見つかりません' }, { status: 404 });

  const { error } = await supabaseServer
    .from('trace_reports')
    .update({
      status: body.action === 'action' ? 'actioned' : 'dismissed',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin',
    })
    .eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (body.action === 'action') {
    const { error: deleteError } = await supabaseServer
      .from('traces')
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: 'admin' })
      .eq('id', report.trace_id);
    if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
