// GET /api/admin/comments — 運営ダッシュボード向けの全コメント一覧（合言葉必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: comments, error } = await supabaseServer
    .from('trace_comments')
    .select('id, created_at, trace_id, user_id, body, is_deleted')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const traceIds = Array.from(new Set((comments ?? []).map((c) => c.trace_id)));
  const userIds = Array.from(new Set((comments ?? []).map((c) => c.user_id)));

  const [{ data: traces }, { data: profiles }] = await Promise.all([
    traceIds.length > 0
      ? supabaseServer.from('traces').select('id, title, is_deleted').in('id', traceIds)
      : Promise.resolve({ data: [] as { id: string; title: string; is_deleted: boolean }[] }),
    userIds.length > 0
      ? supabaseServer.from('profiles').select('id, username').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; username: string }[] }),
  ]);

  const traceById = new Map((traces ?? []).map((t) => [t.id, t]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const enriched = (comments ?? []).map((c) => ({
    ...c,
    trace_title: traceById.get(c.trace_id)?.title ?? null,
    trace_deleted: traceById.get(c.trace_id)?.is_deleted ?? false,
    username: profileById.get(c.user_id)?.username ?? null,
  }));

  return NextResponse.json({ ok: true, comments: enriched });
}
