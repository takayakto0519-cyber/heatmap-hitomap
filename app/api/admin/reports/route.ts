import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// GET /api/admin/reports?status=pending — 通報一覧（パスワード必須）。対象トレースの基本情報も付けて返す。
export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get('status') ?? 'pending';

  const { supabaseServer } = await import('@/lib/supabase/server');
  let query = supabaseServer.from('trace_reports').select('*').order('created_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);

  const { data: reports, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const traceIds = [...new Set((reports ?? []).map((r) => r.trace_id))];
  const { data: traces } = traceIds.length > 0
    ? await supabaseServer.from('traces').select('id, title, photo_url, is_deleted').in('id', traceIds)
    : { data: [] as { id: string; title: string; photo_url: string | null; is_deleted: boolean }[] };
  const traceById = new Map((traces ?? []).map((t) => [t.id, t]));

  const enriched = (reports ?? []).map((r) => ({ ...r, trace: traceById.get(r.trace_id) ?? null }));
  return NextResponse.json({ ok: true, reports: enriched });
}
