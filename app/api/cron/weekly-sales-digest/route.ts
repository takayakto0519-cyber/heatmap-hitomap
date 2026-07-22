// GET /api/cron/weekly-sales-digest — Vercel Cronから毎週月曜朝に呼ばれる。
// 「ビジネスの一連の流れ」の週次サマリーをDiscordに送る。受注率・パイプライン総額・
// 今週の入金・未入金・要フォロー件数——ダッシュボードを開かなくても数字だけは追える。
// 集計式は lib/dealMetrics.ts / lib/followQueue.ts と同じもの（画面の数字とズレない）。
import { NextRequest, NextResponse } from 'next/server';
import { notifyDiscord, notifyDiscordError } from '@/lib/discord';
import { computePipelineSummary, computeWinRate, computeCashflow, type DealCase } from '@/lib/dealMetrics';
import { buildUnifiedFollowQueue } from '@/lib/followQueue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

function yen(n: number): string {
  return `${n.toLocaleString()}円`;
}

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: '認証に失敗しました' }, { status: 401 });
    }
  }

  try {
    const { supabaseServer } = await import('@/lib/supabase/server');

    const [casesRes, leadsRes, emailsRes, municipalitiesRes, dossiersRes] = await Promise.all([
      supabaseServer.from('business_cases')
        .select('id, org_name, stage, amount, probability, expected_close_date, won_at, lost_reason, invoice_sent_at, payment_due, paid_at, last_contact_at'),
      supabaseServer.from('client_leads').select('id, org_name, email_sent_at, email_reply, followed_up_at, status').not('email_sent_at', 'is', null),
      supabaseServer.from('sales_email_targets').select('id, company, email_sent_at, email_reply, followed_up_at').not('email_sent_at', 'is', null),
      supabaseServer.from('municipality_profiles').select('id, region_name, email_sent_at, email_reply, followed_up_at, on_hold').not('email_sent_at', 'is', null),
      supabaseServer.from('client_dossiers').select('id, org_name, next_meeting'),
    ]);

    const cases = (casesRes.data ?? []) as DealCase[];
    const pipeline = computePipelineSummary(cases);
    const winRate = computeWinRate(cases);
    const cashflow = computeCashflow(cases);
    const followQueue = buildUnifiedFollowQueue({
      leads: leadsRes.data ?? [],
      emailTargets: emailsRes.data ?? [],
      municipalities: municipalitiesRes.data ?? [],
      cases: cases.map(c => ({ id: c.id, org_name: c.org_name, stage: c.stage, last_contact_at: c.last_contact_at })),
      dossiers: dossiersRes.data ?? [],
    });
    const overdueCount = followQueue.filter(i => i.status === 'overdue').length;

    const lines = [
      '**📊 週次売上ダイジェスト**',
      `パイプライン総額：${yen(pipeline.pipelineTotal)}（期待値 ${yen(pipeline.expectedValue)}・オープン案件${pipeline.openCount}件）`,
      `受注率：${winRate.rate === null ? '—' : `${winRate.rate}%`}（受注${winRate.won}／見送り${winRate.lost}）`,
      `今月の受注額：${yen(cashflow.wonThisMonth)}　今月の入金済み：${yen(cashflow.paidThisMonth)}`,
      `未入金：${yen(cashflow.unpaidTotal)}${cashflow.overdueTotal > 0 ? `（うち期限超過 ${yen(cashflow.overdueTotal)}）` : ''}`,
      `⏰ 要フォロー：${overdueCount}件`,
      '運営ダッシュボードの「営業」「収益・損益」タブで詳細を確認してください。',
    ];
    notifyDiscord(lines.join('\n'));

    return NextResponse.json({ ok: true, pipeline, winRate, cashflow, overdueCount });
  } catch (e) {
    notifyDiscordError('weekly-sales-digest', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
