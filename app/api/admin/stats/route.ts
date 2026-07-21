// GET /api/admin/stats — 管理ダッシュボードの概要数値（パスワード必須）
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { summarizeValence } from '@/lib/emotions';
import { DEMO_SESSION_CODE, DEMO_TITLE_PREFIX } from '@/lib/demoData';
import { safeCount, safeRows } from '@/lib/adminApi';
import { computeFollowUp } from '@/lib/followUp';

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
  // 商談デモの直前など、あえて見たいときだけ ?includeDemo=true を付けて呼ぶ（lib/demoDataと同じ流儀）
  const includeDemo = req.nextUrl.searchParams.get('includeDemo') === 'true';

  const demoOrFilter = `session_code.eq.${DEMO_SESSION_CODE},title.ilike.${DEMO_TITLE_PREFIX}%`;

  const [
    { count: totalTracesRaw },
    { count: pendingReview },
    { count: last7DaysRaw },
    { count: profileCount },
    { count: routeCount },
    { count: activeSponsors },
    { count: pendingReports },
    { count: demoTraceCount },
    { count: demoTrace7dCount },
  ] = await Promise.all([
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('visibility', 'pending_review').eq('is_deleted', false),
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', sevenDaysAgo),
    supabaseServer.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseServer.from('routes').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabaseServer.from('sponsors').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabaseServer.from('trace_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('is_deleted', false).or(demoOrFilter),
    supabaseServer.from('traces').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', sevenDaysAgo).or(demoOrFilter),
  ]);

  // 商談デモ用の合成データ（scripts/seed-demo-sales-data.mjs）は本日基準の日付で投入されるため、
  // 総投稿数・直近7日の両方に混ざる。既定では除いて表示し、?includeDemo=true で含める
  const totalTraces = includeDemo ? totalTracesRaw : (totalTracesRaw ?? 0) - (demoTraceCount ?? 0);
  const last7Days = includeDemo ? last7DaysRaw : (last7DaysRaw ?? 0) - (demoTrace7dCount ?? 0);

  // 自治体向けサマリー（好意的/否定的の内訳）：全国公開済みの投稿のみを対象にする（exportと同じ範囲）
  const { data: publicEmotions } = await supabaseServer
    .from('traces').select('emotion_key').eq('is_deleted', false).eq('visibility', 'public');
  const valence = summarizeValence((publicEmotions ?? []).map((t) => t.emotion_key));

  // ---------- サイドバーの未処理バッジ ----------
  // このAPIは app/admin/dashboard/page.tsx の tryUnlock() がログイン判定にも使っている。
  // 未作成テーブルへのクエリが1本でも例外を投げると ok:false になり会長が入れなくなるため、
  // 以下は必ず safeCount / safeRows（失敗しても0・空配列）で包むこと。
  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    actionItemsPending,
    bookingPending,
    proposalsUnread,
    marketingUnread,
    fundingSoon,
    emailTargets,
    municipalityTargets,
  ] = await Promise.all([
    safeCount(() => supabaseServer.from('action_items').select('id', { count: 'exact', head: true }).neq('status', 'done')),
    safeCount(() => supabaseServer.from('booking_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    safeCount(() => supabaseServer.from('strategy_proposals').select('id', { count: 'exact', head: true }).eq('status', 'unread').in('category', ['competitor_insight', 'pricing'])),
    safeCount(() => supabaseServer.from('strategy_proposals').select('id', { count: 'exact', head: true }).eq('status', 'unread').eq('category', 'marketing')),
    safeCount(() => supabaseServer.from('funding_opportunities').select('id', { count: 'exact', head: true }).in('status', ['watching', 'preparing']).not('deadline', 'is', null).lte('deadline', in14Days)),
    // 「要フォロー」はSQLのcountでは表現できない（経過日数の判定が必要）ため、
    // 必要な列だけ取って lib/followUp.ts の純粋関数をサーバー側で回す。
    safeRows<{ email_sent_at: string | null; email_reply: string | null; followed_up_at: string | null }>(
      () => supabaseServer.from('sales_email_targets').select('email_sent_at, email_reply, followed_up_at').not('email_sent_at', 'is', null),
    ),
    safeRows<{ email_sent_at: string | null; email_reply: string | null; followed_up_at: string | null }>(
      () => supabaseServer.from('municipality_profiles').select('email_sent_at, email_reply, followed_up_at').not('email_sent_at', 'is', null),
    ),
  ]);

  const overdueCount = [...emailTargets, ...municipalityTargets]
    .filter(r => computeFollowUp(r)?.status === 'overdue').length;

  // タブIDをキーにしたマップで返す。バッジを増やしたいときはここにキーを足すだけでよく、
  // 画面側（page.tsx の badgeFor / OverviewTab のクイックアクセス）は変更不要。
  const badges: Record<string, number> = {
    review: pendingReview ?? 0,
    reports: pendingReports ?? 0,
    secretary: actionItemsPending + bookingPending,
    proposals: proposalsUnread,
    marketing: marketingUnread,
    funding: fundingSoon,
    sales: overdueCount,
  };

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
      valence,
      badges,
    },
    demoHiddenCount: includeDemo ? 0 : (demoTraceCount ?? 0),
  });
}
