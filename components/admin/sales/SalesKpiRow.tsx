'use client';

// 商流ボードの計器盤。パイプライン総額・期待値・受注率・返信率・未入金を1行に並べる。
// 計算は全て lib/dealMetrics.ts の純関数（基準を1箇所に集約する既存方針を踏襲）。
import { computePipelineSummary, computeWinRate, computeCashflow, computeReplyRate, type DealCase, type OutreachRow } from '@/lib/dealMetrics';

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

function yen(n: number): string {
  return `${n.toLocaleString()}円`;
}

export default function SalesKpiRow({ cases, outreach }: { cases: DealCase[]; outreach: OutreachRow[] }) {
  const pipeline = computePipelineSummary(cases);
  const winRate = computeWinRate(cases);
  const cashflow = computeCashflow(cases);
  const reply = computeReplyRate(outreach);

  const kpis = [
    { label: 'パイプライン総額', value: yen(pipeline.pipelineTotal), sub: `オープン案件 ${pipeline.openCount}件`, color: '#4A69BD' },
    { label: '期待値', value: yen(pipeline.expectedValue), sub: '確度で加重した見込み', color: '#8E44AD' },
    { label: '受注率', value: winRate.rate === null ? '—' : `${winRate.rate}%`, sub: `受注${winRate.won} / 見送り${winRate.lost}`, color: '#27AE60' },
    { label: '返信率', value: reply.rate === null ? '—' : `${reply.rate}%`, sub: `送信${reply.sent}件中${reply.replied}件`, color: '#38ADA9' },
    {
      label: '未入金', value: yen(cashflow.unpaidTotal),
      sub: cashflow.overdueTotal > 0 ? `うち期限超過 ${yen(cashflow.overdueTotal)}` : '期限超過なし',
      color: cashflow.overdueTotal > 0 ? '#E74C3C' : '#E5A139',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
      {kpis.map((k) => (
        <div key={k.label} style={{ ...cardStyle, borderTop: `3px solid ${k.color}` }}>
          <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>{k.label}</p>
          <p style={{ margin: '4px 0 2px', fontSize: 17, fontWeight: 800, color: '#333' }}>{k.value}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{k.sub}</p>
        </div>
      ))}
    </div>
  );
}
