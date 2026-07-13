import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function getServerClient() {
  const { supabaseServer } = await import('@/lib/supabase/server');
  return supabaseServer;
}

// POST /api/admin/traces/[id]/review — 全国公開申請の承認・却下
export async function POST(req: NextRequest, context: { params: { id: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }
  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as { action?: 'approve' | 'reject' };
  if (body.action !== 'approve' && body.action !== 'reject') {
    return NextResponse.json({ ok: false, error: 'actionはapprove/rejectのいずれかです' }, { status: 400 });
  }
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('traces')
    .update({ visibility: body.action === 'approve' ? 'public' : 'private' })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, trace: data });
}
