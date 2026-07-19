'use client';

// まきチャレ2026（牧之原市チャレンジビジネスコンテスト）専用ダッシュボード。
// 一般の「ビジネスモデル案」タブ（運営ダッシュボード内）とは別に、
// このコンテストの6案だけを絞り込んで、1案ずつレポートを肉付けしていくための画面。
// データは biz_model_ideas テーブルの contest='makichalle2026' 行を使う（既存テーブルを流用、専用フィールドのみ追加）。
import { useCallback, useEffect, useState } from 'react';

const CONTEST = 'makichalle2026';
const DEADLINE = '2026-08-03T23:59:00+09:00';

interface Idea {
  id: string;
  idea_no: number | null;
  title: string;
  memo: string | null;
  report_md: string | null;
  status: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: '💡 アイデア', color: '#8E44AD' },
  validating: { label: '🔍 検証中', color: '#F6B93B' },
  building: { label: '🛠 肉付け中', color: '#4A69BD' },
  live: { label: '✅ 提出準備OK', color: '#38ADA9' },
  shelved: { label: '📦 保留', color: '#aaa' },
};

function useCountdown(target: string) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    function tick() {
      const diffMs = new Date(target).getTime() - Date.now();
      if (diffMs <= 0) { setLabel('締切を過ぎています'); return; }
      const days = Math.floor(diffMs / 86400000);
      const hours = Math.floor((diffMs % 86400000) / 3600000);
      setLabel(`あと ${days}日${hours}時間`);
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [target]);
  return label;
}

export default function MakichalleDashboardPage() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { memo: string; report_md: string; status: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const countdown = useCountdown(DEADLINE);

  const authHeaders = useCallback((): HeadersInit => (
    { 'Content-Type': 'application/json', 'x-admin-password': password }
  ), [password]);

  const load = useCallback((pw: string) => {
    setLoading(true);
    fetch(`/api/admin/biz-model-ideas?contest=${CONTEST}`, { headers: { 'x-admin-password': pw } })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) throw new Error(d.error ?? '取得に失敗しました');
        const list = d.ideas as Idea[];
        setIdeas(list);
        const map: Record<string, { memo: string; report_md: string; status: string }> = {};
        for (const i of list) map[i.id] = { memo: i.memo ?? '', report_md: i.report_md ?? '', status: i.status };
        setDrafts(map);
      })
      .catch(e => setError(e instanceof Error ? e.message : '通信エラー'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_dashboard_password') ?? sessionStorage.getItem('hm-admin-pw');
    if (saved) tryUnlock(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tryUnlock(pw: string) {
    setUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch(`/api/admin/biz-model-ideas?contest=${CONTEST}`, { headers: { 'x-admin-password': pw } });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'パスワードが違います');
      setPassword(pw);
      setUnlocked(true);
      sessionStorage.setItem('admin_dashboard_password', pw);
      load(pw);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : '認証に失敗しました');
    } finally {
      setUnlocking(false);
    }
  }

  async function save(id: string) {
    const d = drafts[id];
    if (!d) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/biz-model-ideas/${id}`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify(d),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      load(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSavingId(null);
    }
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', padding: 16 }}>
        <form onSubmit={e => { e.preventDefault(); tryUnlock(password); }}
          style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 320, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ fontWeight: 800, margin: '0 0 12px' }}>🍵 まきチャレ2026 ダッシュボード</p>
          <input type="password" placeholder="管理パスワード" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', boxSizing: 'border-box', marginBottom: 10 }} />
          {unlockError && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 10px' }}>{unlockError}</p>}
          <button type="submit" disabled={unlocking} style={{
            width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
            background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>{unlocking ? '確認中…' : '開く'}</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'inherit' }}>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 4px' }}>牧之原市チャレンジビジネスコンテスト（運営：CFSパートナーズ）</p>
      <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900 }}>🍵 まきチャレ2026 事業案ダッシュボード</h1>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
        <span style={{ padding: '4px 10px', borderRadius: 20, background: '#FDEBD0', color: '#B9770E', fontWeight: 800, fontSize: 12 }}>
          提出締切 2026-08-03（{countdown}）
        </span>
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading && <p style={{ color: '#999' }}>読み込み中…</p>}
      {!loading && ideas.length === 0 && (
        <p style={{ color: '#aaa', fontSize: 13 }}>
          まだこのコンテスト用のデータがありません。既存の6案に contest=&apos;{CONTEST}&apos; と idea_no を付ける
          SQLをSupabaseのSQL Editorで実行してください。
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ideas.map(i => {
          const isOpen = openId === i.id;
          const statusInfo = STATUS_LABELS[drafts[i.id]?.status ?? i.status] ?? STATUS_LABELS.idea;
          return (
            <div key={i.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #eee', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
                onClick={() => setOpenId(isOpen ? null : i.id)}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>
                  {i.idea_no ? `${['①','②','③','④','⑤','⑥','⑦'][i.idea_no - 1] ?? i.idea_no} ` : ''}{i.title}
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
                </p>
                <span style={{ color: '#bbb', fontSize: 13 }}>{isOpen ? '閉じる ▲' : '開く ▼'}</span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_LABELS).map(([key, info]) => (
                      <button key={key}
                        onClick={() => setDrafts(prev => ({ ...prev, [i.id]: { ...prev[i.id], status: key } }))}
                        style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          border: (drafts[i.id]?.status ?? i.status) === key ? `1.5px solid ${info.color}` : '1.5px solid #eee',
                          background: (drafts[i.id]?.status ?? i.status) === key ? info.color + '22' : '#fff',
                          color: info.color,
                        }}>{info.label}</button>
                    ))}
                  </div>

                  <label style={{ fontSize: 11, color: '#999', fontWeight: 700 }}>ひとことメモ</label>
                  <textarea value={drafts[i.id]?.memo ?? ''} rows={2}
                    onChange={e => setDrafts(prev => ({ ...prev, [i.id]: { ...prev[i.id], memo: e.target.value } }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1.5px solid #eee', fontFamily: 'inherit', fontSize: 13 }} />

                  <label style={{ fontSize: 11, color: '#999', fontWeight: 700 }}>専用レポート（Markdown）</label>
                  <textarea value={drafts[i.id]?.report_md ?? ''} rows={16}
                    onChange={e => setDrafts(prev => ({ ...prev, [i.id]: { ...prev[i.id], report_md: e.target.value } }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1.5px solid #eee', fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.6 }} />

                  <button onClick={() => save(i.id)} disabled={savingId === i.id} style={{
                    alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  }}>{savingId === i.id ? '保存中…' : '保存する'}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
