'use client';

// 💪 ビジネスモデル強化 — 分散した事業案・損益・AI提案・インサイトを横断して、
// 「次にどこを磨けばいいか」を1画面で示す読み取り専用の司令塔。
// 新テーブル・新APIは作らず、既存5本のGET APIをクライアント側で集約するだけ（Promise.all）。
// 編集はここでは行わない——各項目は既存タブ・専用ダッシュボードへ誘導する。
import { useEffect, useState } from 'react';
import { Card, MigrationNotice, ADMIN_COLORS } from '@/components/admin/adminShared';
import {
  computeIdeaScore, computeLineTrend, detectWeaknesses,
  type BizModelIdeaForHealth, type DeliverableForHealth, type ProposalForHealth, type PnlEntryForHealth,
  type Weakness, type IdeaRank,
} from '@/lib/bizHealth';

const RANK_COLOR: Record<IdeaRank, string> = { A: ADMIN_COLORS.teal, B: ADMIN_COLORS.yellow, C: ADMIN_COLORS.red };

function yen(n: number): string {
  return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString() + '円';
}

export default function BizModelStrengthenTab({ authHeaders, goTab }: {
  authHeaders: () => HeadersInit;
  goTab: (id: string) => void;
}) {
  const [ideas, setIdeas] = useState<BizModelIdeaForHealth[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableForHealth[]>([]);
  const [proposals, setProposals] = useState<ProposalForHealth[]>([]);
  const [pnlEntries, setPnlEntries] = useState<PnlEntryForHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [migrationNotices, setMigrationNotices] = useState<{ title: string; migrationFile: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const notices: { title: string; migrationFile: string }[] = [];
    Promise.all([
      fetch('/api/admin/biz-model-ideas', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/admin/ai-deliverables?entity_type=new_biz', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/admin/strategy-proposals', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/admin/business-line-pnl', { headers: authHeaders() }).then(r => r.json()),
    ])
      .then(([ideasRes, deliverablesRes, proposalsRes, pnlRes]) => {
        if (ideasRes.ok) {
          setIdeas(ideasRes.ideas ?? []);
          if (ideasRes.needsMigration) notices.push({ title: 'ビジネスモデル案', migrationFile: ideasRes.migrationFile });
        } else setError(prev => prev || (ideasRes.error ?? '取得に失敗しました'));

        if (deliverablesRes.ok) {
          setDeliverables(deliverablesRes.deliverables ?? []);
          if (deliverablesRes.needsMigration) notices.push({ title: 'AI提案', migrationFile: deliverablesRes.migrationFile });
        }
        if (proposalsRes.ok) {
          setProposals(proposalsRes.proposals ?? []);
          if (proposalsRes.needsMigration) notices.push({ title: '競合・価格インサイト', migrationFile: proposalsRes.migrationFile });
        }
        if (pnlRes.ok) {
          setPnlEntries(pnlRes.entries ?? []);
          if (pnlRes.needsMigration) notices.push({ title: '事業別損益', migrationFile: pnlRes.migrationFile });
        }
        setMigrationNotices(notices);
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const lineTrends = computeLineTrend(pnlEntries);
  const weaknesses = detectWeaknesses(ideas, deliverables, proposals);
  const unreadProposalCount = proposals.filter(p => p.status === 'unread').length;

  function copyPrompt(w: Weakness) {
    if (w.action.type !== 'copyPrompt') return;
    navigator.clipboard.writeText(w.action.text).then(() => {
      setCopiedId(`${w.ideaId}-${w.label}`);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        既存の事業案・損益・AI提案・インサイトを横断して、次に磨くべき場所を示します。ここでは編集できません——各項目のリンク先で直してください。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {migrationNotices.map(n => (
        <MigrationNotice key={n.migrationFile} title={`${n.title}のテーブルがまだ作成されていません`} migrationFile={n.migrationFile} />
      ))}

      {/* 1. 事業ライン健全性カード列 */}
      <p style={{ fontWeight: 800, fontSize: 14, margin: '4px 0 8px' }}>📊 事業ライン損益（直近月）</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        {lineTrends.map(t => {
          const diff = t.prevProfit === null ? null : t.latestProfit - t.prevProfit;
          return (
            <div key={t.key} onClick={() => goTab('money')} style={{
              cursor: 'pointer', background: '#fff', borderRadius: 12, padding: '12px 14px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              borderTop: `3px solid ${t.recordedThisMonth ? ADMIN_COLORS.teal : ADMIN_COLORS.orange}`,
            }}>
              <p style={{ margin: 0, fontSize: 11, color: '#999', fontWeight: 700 }}>{t.label}</p>
              <p style={{ margin: '4px 0 2px', fontSize: 16, fontWeight: 800, color: '#333' }}>
                {t.latestMonth ? yen(t.latestProfit) : '未記録'}
              </p>
              <p style={{ margin: 0, fontSize: 10.5, color: '#aaa' }}>
                {t.latestMonth ? `${t.latestMonth}` : ''}
                {diff !== null && (diff >= 0 ? ` ▲${yen(diff)}` : ` ▼${yen(-diff)}`)}
                {!t.recordedThisMonth && t.latestMonth && ' ・今月未記録⚠'}
              </p>
            </div>
          );
        })}
      </div>

      {/* 2. 磨き込みアクション */}
      <p style={{ fontWeight: 800, fontSize: 14, margin: '4px 0 8px' }}>🔧 磨き込みアクション</p>
      {weaknesses.length === 0 ? (
        <Card style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, color: ADMIN_COLORS.teal, fontWeight: 700 }}>磨き込み待ちはありません。新しい種は💡ビジネスモデル案へ。</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {weaknesses.map((w, idx) => {
            const key = `${w.ideaId}-${w.label}`;
            return (
              <Card key={`${key}-${idx}`} style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#888' }}>{w.ideaTitle}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#333' }}>⚠ {w.label}</p>
                  </div>
                  {w.action.type === 'copyPrompt' && (
                    <button onClick={() => copyPrompt(w)} style={{
                      flexShrink: 0, padding: '5px 12px', borderRadius: 8, border: 'none',
                      background: ADMIN_COLORS.teal, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}>{copiedId === key ? 'コピーしました' : 'AIに依頼する文をコピー'}</button>
                  )}
                  {w.action.type === 'openDashboard' && (
                    <a href={`/admin/bizmodel/${w.action.ideaId}`} target="_blank" rel="noopener noreferrer" style={{
                      flexShrink: 0, padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${ADMIN_COLORS.teal}`,
                      color: ADMIN_COLORS.teal, fontWeight: 700, fontSize: 12, textDecoration: 'none',
                    }}>専用ダッシュボードへ →</a>
                  )}
                  {w.action.type === 'goTab' && (
                    <button onClick={() => goTab(w.action.type === 'goTab' ? w.action.tab : '')} style={{
                      flexShrink: 0, padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${ADMIN_COLORS.blue}`,
                      background: '#fff', color: ADMIN_COLORS.blue, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}>該当タブへ →</button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 3. 事業案スコアカード一覧 */}
      <p style={{ fontWeight: 800, fontSize: 14, margin: '4px 0 8px' }}>💡 事業案スコア</p>
      {ideas.length === 0 ? (
        <Card style={{ marginBottom: 20 }}><p style={{ margin: 0, fontSize: 13, color: '#999' }}>まだ事業案がありません。</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {ideas.map(idea => {
            const { score, rank, breakdown } = computeIdeaScore(idea);
            return (
              <Card key={idea.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>{idea.title}</p>
                  <span style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
                    color: '#fff', background: RANK_COLOR[rank],
                  }}>{rank}</span>
                </div>
                <div style={{ background: '#eee', borderRadius: 6, height: 6, margin: '8px 0', overflow: 'hidden' }}>
                  <div style={{ width: `${score}%`, height: '100%', background: RANK_COLOR[rank] }} />
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#888' }}>
                  <span>{breakdown.phase ? '🚦✅' : '🚦—'} フェーズ進行</span>
                  <span>{breakdown.validation ? '🔍✅' : '🔍—'} 検証</span>
                  <span>{breakdown.mvp ? '📐✅' : '📐—'} MVP</span>
                  <span>{breakdown.plan ? '📋✅' : '📋—'} 計画</span>
                  <span>{breakdown.bmc ? '🧩✅' : '🧩—'} BMC</span>
                  <span>{breakdown.freshness ? '⏱✅' : '⏱—'} 鮮度</span>
                </div>
                <a href={`/admin/bizmodel/${idea.id}`} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-block', marginTop: 8, fontSize: 12, color: ADMIN_COLORS.teal, fontWeight: 700, textDecoration: 'none',
                }}>専用ダッシュボードを開く →</a>
              </Card>
            );
          })}
        </div>
      )}

      {/* 4. インサイト連携ストリップ */}
      <p style={{ fontWeight: 800, fontSize: 14, margin: '4px 0 8px' }}>🔗 関連インサイト</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => goTab('proposals')} style={{
          padding: '8px 14px', borderRadius: 10, border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: 12.5,
        }}>🔍 競合・価格インサイト{unreadProposalCount > 0 ? `（未読${unreadProposalCount}件）` : ''}</button>
        <button onClick={() => goTab('marketing')} style={{
          padding: '8px 14px', borderRadius: 10, border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: 12.5,
        }}>📈 マーケティング提案</button>
        <button onClick={() => goTab('orgdocs')} style={{
          padding: '8px 14px', borderRadius: 10, border: '1px solid #eee', background: '#fff', cursor: 'pointer', fontSize: 12.5,
        }}>📁 経営資料</button>
      </div>
    </div>
  );
}
