// GET /api/admin/stats — 管理ダッシュボードの概要数値（合言葉必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: '合言葉が違います' }, { status: 401 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalTraces },
    { count: pendingReview },
    { count: last7Days },
    { count: profileCount },
    { count: routeCount },
    { count: activeSponsors },
    { count: pendingReports },
  ] = await Promise.all([
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('visibility', 'pending_review').eq('is_deleted', false),
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', sevenDaysAgo),
    supabaseServer.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseServer.from('routes').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabaseServer.from('sponsors').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabaseServer.from('trace_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  return NextResponse.json({
    ok: true,
    stats: {
      totalTraces: totalTraces ?? 0,
      pendingReview: pendingReview ?? 0,
      last7Days: last7Days ?? 0,
      profileCount: profileCount ?? 0,
      routeCount: routeCount ?? 0,
      activeSponsors: activeSponsors ?? 0,
      pendingReports: pendingReports ?? 0,
    },
  });
}
