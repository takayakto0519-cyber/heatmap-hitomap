// POST /api/admin/blocks/reorder { page, order: [id, id, ...] } — 表示順を一括更新
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { revalidateSitePages } from '@/lib/revalidateSite';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function POST(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { order?: string[] };
  if (!Array.isArray(body.order) || body.order.length === 0) {
    return NextResponse.json({ ok: false, error: 'order は必須です' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const results = await Promise.all(
    body.order.map((id, i) =>
      supabaseServer.from('site_blocks').update({ sort_order: i, updated_at: new Date().toISOString() }).eq('id', id)
    )
  );
  const failed = results.find(r => r.error);
  if (failed?.error) return NextResponse.json({ ok: false, error: failed.error.message }, { status: 500 });
  revalidateSitePages(); // 並び替えた瞬間にサイトへ反映
  return NextResponse.json({ ok: true });
}
