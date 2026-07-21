'use client';

// 📣 マーケティングボード：free-diagnosis-content / kit-landing-page 等のマーケティング施策系スキルが出した
// 提案を一覧・ステータス管理する受信トレイ（strategy_proposalsテーブルのcategory='marketing'のみを扱う）。
// 新規事業は「💡ビジネスモデル案」、競合・価格は「🔍競合・価格インサイト」タブへそれぞれ一本化済み。
// 登録・更新はAI APIの自動呼び出しではなく、会長がチャットで「登録して」と指示した時にClaude Codeが書き込む運用。
import { useCallback, useEffect, useState } from 'react';
import { Card, MigrationNotice, inputStyle } from '@/components/admin/adminShared';
import AgentDigestPanel from '@/components/admin/AgentDigestPanel';

// ニュース番人は9分野を集めてくるので、マーケ関連の分野だけに絞る。
// この分野名は agents/marketing_digest.py の NEWS_DIGEST_CATEGORY と揃えること。
const MARKETING_NEWS_CATEGORIES = ['観光・関係人口・採用DX'];

interface StrategyProposal {
  id: string;
  category: string;
  source_skill: string | null;
  title: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unread: { label: '📥 未読', color: '#999' },
  reviewing: { label: '🔍 検討中', color: '#F6B93B' },
  adopted: { label: '🚀 実行', color: '#E67E22' },
  shelved: { label: '📦 見送り', color: '#ccc' },
};

export default function MarketingProposalsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [proposals, setProposals] = useState<StrategyProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [migrationFile, setMigrationFile] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/strategy-proposals', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setProposals((d.proposals as StrategyProposal[]).filter(p => p.category === 'marketing'));
          setMigrationFile(d.needsMigration ? d.migrationFile : null);
        }
        else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function updateProposal(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/strategy-proposals/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deleteProposal(id: string) {
    if (!confirm('この提案を削除しますか？')) return;
    const res = await fetch(`/api/admin/strategy-proposals/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        マーケティング施策の提案を一覧するボードです（新規事業は「💡ビジネスモデル案」、競合・価格は「🔍競合・価格インサイト」タブへ）。
        登録は会長がチャットで「登録して」と指示した時のみ行われます（自動送信・自動投稿はありません）。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {migrationFile && <MigrationNotice title="提案ボードのテーブルがまだ作成されていません" migrationFile={migrationFile} />}

      <AgentDigestPanel
        authHeaders={authHeaders}
        agentIds={['news_digest', 'marketing_digest']}
        categoryFilter={MARKETING_NEWS_CATEGORIES}
        title="🤖 番人が自動で集めてきた最新のニュース"
        hint="ニュース番人が拾った観光・関係人口・採用DXの記事です。ここは読むだけで保存はされません。施策の種になりそうなものは、チャットで「これ登録して」と言ってください。"
      />

      <p style={{ margin: '18px 0 4px', fontWeight: 800, fontSize: 13.5 }}>📌 会長が残した提案</p>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#999' }}>
        会長が「登録して」と指示したマーケティング施策だけがここに残ります。
      </p>
      {proposals.length === 0 && <p style={{ color: '#aaa' }}>まだ提案がありません。</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {proposals.map(p => {
          const statusInfo = STATUS_LABELS[p.status] ?? STATUS_LABELS.unread;
          const isOpen = !!expanded[p.id];
          return (
            <Card key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{p.title}</p>
                  {p.source_skill && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>/{p.source_skill}</p>}
                </div>
                <button onClick={() => deleteProposal(p.id)} style={{
                  padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                {Object.entries(STATUS_LABELS).map(([key, info]) => (
                  <button key={key} onClick={() => updateProposal(p.id, { status: key })} style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                    border: `1.5px solid ${p.status === key ? info.color : '#ddd'}`,
                    background: p.status === key ? info.color + '18' : '#fff',
                    color: p.status === key ? info.color : '#999', fontWeight: p.status === key ? 700 : 400,
                  }}>{info.label}</button>
                ))}
              </div>

              <button onClick={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))} style={{
                fontSize: 12, color: '#38ADA9', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>{isOpen ? '▲ 本文を閉じる' : '▼ 本文を開く'}</button>

              {isOpen && (
                <pre style={{
                  ...inputStyle, width: '100%', boxSizing: 'border-box', whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit', margin: '8px 0 0', maxHeight: 400, overflowY: 'auto',
                }}>{p.body}</pre>
              )}

              <p style={{ margin: '8px 0 0', fontSize: 10, color: '#ccc' }}>
                登録: {new Date(p.created_at).toLocaleString('ja-JP')}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
