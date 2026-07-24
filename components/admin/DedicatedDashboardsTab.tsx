'use client';

// 📊 専用ダッシュボード — コンテスト・事業ライン・商談中の案件ごとに新設してきた
// 独立ページ（/admin/makichalle・/admin/bizmodel/[id]・/admin/case/[id]）への入口を
// 1箇所に集約する。増えるたびに直接URLを覚える必要がないようにするためのハブ。
import { useEffect, useState } from 'react';
import { CASE_STAGE_ORDER } from '@/lib/dealMetrics';
import { Card } from '@/components/admin/adminShared';

interface BizModelIdea { id: string; title: string; status: string; phase?: number; }
interface BusinessCase { id: string; org_name: string; stage: string; client_type: string; }

const PHASE_LABELS = ['ショーケース確立', 'MVP', '展開', 'スケール'];

// アンカー(<a>)と合成する用。adminShared.Card と同じ値（radius12・同影）で揃えている。
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#444', margin: '22px 0 10px' };
const linkCardStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
  padding: '12px 14px', borderRadius: 10, background: '#F4F6F5', textDecoration: 'none', color: 'inherit',
};

export default function DedicatedDashboardsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [ideas, setIdeas] = useState<BizModelIdea[]>([]);
  const [cases, setCases] = useState<BusinessCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/biz-model-ideas', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/admin/business-cases', { headers: authHeaders() }).then(r => r.json()),
    ])
      .then(([ideasRes, casesRes]) => {
        if (ideasRes.ok) setIdeas(ideasRes.ideas ?? []);
        if (casesRes.ok) setCases(casesRes.cases ?? []);
        if (!ideasRes.ok && !casesRes.ok) setError('取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 案件専用ダッシュボードは「発案・リード・見送り」を除いた、商談以降に進んだものだけを対象にする
  const negotiatingCases = cases.filter(c => {
    const idx = CASE_STAGE_ORDER.indexOf(c.stage as typeof CASE_STAGE_ORDER[number]);
    return idx >= CASE_STAGE_ORDER.indexOf('提案') && c.stage !== '見送り';
  });

  if (loading) return <p style={{ fontSize: 13, color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#999' }}>
        コンテスト・事業ライン・商談中の案件ごとに作られた専用ダッシュボードへの入口です。増えても迷わないよう、ここに集約しています。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      <h2 style={sectionTitleStyle}>🏆 コンテスト・イベント専用</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <a href="/admin/makichalle" target="_blank" rel="noopener noreferrer" style={{ ...cardStyle, ...linkCardStyle }}>
          <div>
            <b style={{ fontSize: 14 }}>🍵 まきチャレ2026（牧之原市）</b>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#999' }}>牧之原市チャレンジビジネスコンテストの提出準備専用ダッシュボード</p>
          </div>
          <span style={{ fontSize: 12, color: '#38ADA9', fontWeight: 700 }}>開く →</span>
        </a>
      </div>

      <h2 style={sectionTitleStyle}>📊 事業ライン専用（{ideas.length}件）</h2>
      {ideas.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 13, color: '#999' }}>まだビジネスモデル案がありません。「ビジネスモデル案」タブから作成してください。</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ideas.map(idea => (
            <a key={idea.id} href={`/admin/bizmodel/${idea.id}`} target="_blank" rel="noopener noreferrer" style={{ ...cardStyle, ...linkCardStyle }}>
              <div>
                <b style={{ fontSize: 14 }}>{idea.title}</b>
                <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#999' }}>
                  {idea.phase != null && `🚦 ${PHASE_LABELS[idea.phase] ?? `フェーズ${idea.phase}`}`}
                </p>
              </div>
              <span style={{ fontSize: 12, color: '#38ADA9', fontWeight: 700, flexShrink: 0 }}>開く →</span>
            </a>
          ))}
        </div>
      )}

      <h2 style={sectionTitleStyle}>📇 案件専用（商談以降・{negotiatingCases.length}件）</h2>
      {negotiatingCases.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 13, color: '#999' }}>商談段階（提案以降）に進んだ案件はまだありません。</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {negotiatingCases.map(c => (
            <a key={c.id} href={`/admin/case/${c.id}`} target="_blank" rel="noopener noreferrer" style={{ ...cardStyle, ...linkCardStyle }}>
              <div>
                <b style={{ fontSize: 14 }}>{c.org_name}</b>
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#8E44AD', background: '#8E44AD18', padding: '2px 9px', borderRadius: 10 }}>{c.stage}</span>
              </div>
              <span style={{ fontSize: 12, color: '#38ADA9', fontWeight: 700, flexShrink: 0 }}>開く →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
