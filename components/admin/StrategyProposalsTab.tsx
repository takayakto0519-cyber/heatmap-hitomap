'use client';

// 💡 経営提案ボード：new-biz-hypothesis / competitor-market-research / market-price-scan 等の
// スキルが出した提案を、01_経営幹部_Executive/配下のMarkdownに埋もれさせず一覧・ステータス管理する受信トレイ。
// 登録・更新はAI APIの自動呼び出しではなく、会長がチャットで「登録して」と指示した時にClaude Codeが書き込む運用。
import { useCallback, useEffect, useState } from 'react';
import { Card, inputStyle } from '@/components/admin/adminShared';

interface StrategyProposal {
  id: string;
  category: string;
  source_skill: string | null;
  title: string;
  body: string;
  status: string;
  linked_biz_model_idea_id: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  new_biz: { label: '🌱 新規事業', color: '#8E44AD' },
  marketing: { label: '📣 マーケティング', color: '#E67E22' },
  competitor_insight: { label: '🔍 競合・市場', color: '#4A69BD' },
  pricing: { label: '💴 価格', color: '#38ADA9' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unread: { label: '📥 未読', color: '#999' },
  reviewing: { label: '🔍 検討中', color: '#F6B93B' },
  adopted: { label: '✅ 採用', color: '#38ADA9' },
  shelved: { label: '📦 見送り', color: '#ccc' },
};

// 競合・市場調査系は近縁スキルが4つあり、重複実行や抜け漏れに気づきにくい。
// 系統マップとして横並びにし、最終登録日を一目で比較できるようにする。
const COMPETITOR_SKILLS: { key: string; label: string }[] = [
  { key: 'competitor-market-research', label: '競合・市場調査' },
  { key: 'competitor-feature-monitor', label: '競合プロダクト機能差分' },
  { key: 'market-price-scan', label: '市場価格調査' },
  { key: 'global-market-research', label: '海外市場調査' },
];

export default function StrategyProposalsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [proposals, setProposals] = useState<StrategyProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [adopting, setAdopting] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/strategy-proposals', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setProposals(d.proposals); else setError(d.error ?? '取得に失敗しました'); })
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

  async function adoptProposal(p: StrategyProposal) {
    setAdopting(prev => ({ ...prev, [p.id]: true }));
    try {
      const res = await fetch('/api/admin/biz-model-ideas', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: p.title, memo: p.body, status: 'idea' }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? 'ビジネスモデル案への登録に失敗しました'); return; }
      await updateProposal(p.id, { status: 'adopted', linked_biz_model_idea_id: data.idea.id });
    } finally {
      setAdopting(prev => ({ ...prev, [p.id]: false }));
    }
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        新規事業・マーケティング・競合調査などのスキルが出した提案を一覧するボードです。
        登録は会長がチャットで「登録して」と指示した時のみ行われます（自動送信・自動投稿はありません）。
        採用した提案は「💡ビジネスモデル案」に自動で複製されます。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      <Card style={{ marginBottom: 14 }}>
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 13 }}>🔍 競合・市場調査 系統マップ</p>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#999' }}>
          近縁スキルが4つあり重複実行や抜け漏れに気づきにくいため、最終登録日を横並びで確認できるようにしています。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {COMPETITOR_SKILLS.map(skill => {
            const latest = proposals
              .filter(p => p.source_skill === skill.key)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            return (
              <div key={skill.key} style={{ border: '1px solid #eee', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700 }}>{skill.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: latest ? '#4A69BD' : '#ccc' }}>
                  {latest ? `最終登録: ${new Date(latest.created_at).toLocaleDateString('ja-JP')}` : '未登録'}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => setCategoryFilter('all')} style={{
          padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
          border: `1.5px solid ${categoryFilter === 'all' ? '#666' : '#ddd'}`,
          background: categoryFilter === 'all' ? '#66666618' : '#fff',
          color: categoryFilter === 'all' ? '#666' : '#999', fontWeight: categoryFilter === 'all' ? 700 : 400,
        }}>すべて</button>
        {Object.entries(CATEGORY_LABELS).map(([key, info]) => (
          <button key={key} onClick={() => setCategoryFilter(key)} style={{
            padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
            border: `1.5px solid ${categoryFilter === key ? info.color : '#ddd'}`,
            background: categoryFilter === key ? info.color + '18' : '#fff',
            color: categoryFilter === key ? info.color : '#999', fontWeight: categoryFilter === key ? 700 : 400,
          }}>{info.label}</button>
        ))}
      </div>

      {proposals.length === 0 && <p style={{ color: '#aaa' }}>まだ提案がありません。</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {proposals.filter(p => categoryFilter === 'all' || p.category === categoryFilter).map(p => {
          const catInfo = CATEGORY_LABELS[p.category] ?? CATEGORY_LABELS.new_biz;
          const statusInfo = STATUS_LABELS[p.status] ?? STATUS_LABELS.unread;
          const isOpen = !!expanded[p.id];
          return (
            <Card key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{p.title}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: catInfo.color }}>{catInfo.label}</span>
                    {p.source_skill && <span style={{ fontSize: 11, color: '#bbb' }}>／ /{p.source_skill}</span>}
                  </div>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <p style={{ margin: 0, fontSize: 10, color: '#ccc' }}>
                  登録: {new Date(p.created_at).toLocaleString('ja-JP')}
                </p>
                {p.linked_biz_model_idea_id ? (
                  <span style={{ fontSize: 11, color: '#38ADA9', fontWeight: 700 }}>💡ビジネスモデル案に登録済み</span>
                ) : (
                  <button onClick={() => adoptProposal(p)} disabled={adopting[p.id]} style={{
                    padding: '5px 12px', borderRadius: 8, border: 'none', background: '#38ADA9',
                    color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}>{adopting[p.id] ? '登録中…' : '💡 ビジネスモデル案に採用'}</button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
