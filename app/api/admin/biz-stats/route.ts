// GET /api/admin/biz-stats — 経営ホーム（overview）用の分野別数値（パスワード必須）
// /api/admin/stats はログイン確認プローブも兼ねているため形を変えず、
// 集客・営業・マネタイズ・守りの数字はこちらに分けて持つ。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: publishedPosts },
    { count: draftPosts },
    { count: newUsers7d },
    { count: traces7d },
    { data: leadRows },
    { count: activeSponsors },
    { count: bonnoHidden },
    { count: pendingReview },
    { count: pendingReports },
  ] = await Promise.all([
    supabaseServer.from('site_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
    supabaseServer.from('site_posts').select('id', { count: 'exact', head: true }).eq('is_published', false),
    supabaseServer.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', sevenDaysAgo),
    supabaseServer.from('client_leads').select('status'),
    supabaseServer.from('sponsors').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabaseServer.from('bonno_submissions').select('id', { count: 'exact', head: true }).neq('status', 'visible'),
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('visibility', 'pending_review').eq('is_deleted', false),
    supabaseServer.from('trace_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  // 営業台帳のステータス別件数（lead | contacted | negotiating | contracted | lost）
  const leadsByStatus: Record<string, number> = {};
  for (const row of leadRows ?? []) {
    const s = (row as { status: string }).status || 'lead';
    leadsByStatus[s] = (leadsByStatus[s] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    biz: {
      attract: {
        publishedPosts: publishedPosts ?? 0,
        draftPosts: draftPosts ?? 0,
        newUsers7d: newUsers7d ?? 0,
        traces7d: traces7d ?? 0,
      },
      sales: {
        leadsByStatus,
        leadsTotal: (leadRows ?? []).length,
      },
      monetize: {
        activeSponsors: activeSponsors ?? 0,
        billingConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
        partnerApiConfigured: Boolean(process.env.PARTNER_API_KEY),
      },
      risk: {
        pendingReview: pendingReview ?? 0,
        pendingReports: pendingReports ?? 0,
        bonnoHidden: bonnoHidden ?? 0,
      },
    },
  });
}
