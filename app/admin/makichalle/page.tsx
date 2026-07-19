'use client';

// まきチャレ2026（牧之原市チャレンジビジネスコンテスト）専用ダッシュボード。
// 2026-07-19時点で主軸は「感情のヒートマップ」1案に絞られたため、複数案を並べる作りをやめ、
// 1案をセクションごとに読みやすく・非エンジニアでも編集しやすく表示する構成にした。
// データは biz_model_ideas テーブルの contest='makichalle2026' 行を使う。
import { useCallback, useEffect, useState } from 'react';
import { IdeaReportEditor, type BizIdea } from '@/components/admin/IdeaReportEditor';

const CONTEST = 'makichalle2026';
const DEADLINE = '2026-08-03T23:59:00+09:00';

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
  const [ideas, setIdeas] = useState<BizIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const countdown = useCountdown(DEADLINE);

  const load = useCallback((pw: string) => {
    setLoading(true);
    fetch(`/api/admin/biz-model-ideas?contest=${CONTEST}`, { headers: { 'x-admin-password': pw } })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) throw new Error(d.error ?? '取得に失敗しました');
        setIdeas(d.ideas);
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

  async function save(id: string, fields: { status?: string; memo?: string; report_md?: string }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/biz-model-ideas/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      load(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
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
      <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900 }}>🍵 まきチャレ2026 ダッシュボード</h1>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <span style={{ padding: '4px 10px', borderRadius: 20, background: '#FDEBD0', color: '#B9770E', fontWeight: 800, fontSize: 12 }}>
          提出締切 2026-08-03（{countdown}）
        </span>
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading && <p style={{ color: '#999' }}>読み込み中…</p>}
      {!loading && ideas.length === 0 && (
        <p style={{ color: '#aaa', fontSize: 13 }}>
          まだこのコンテスト用のデータがありません。Claude Codeに「まきチャレの事業案を登録して」と頼むか、
          運営ダッシュボード（/admin/dashboard）の「ビジネスモデル案」タブから追加してください。
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {ideas.map(idea => (
          <div key={idea.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #eee', padding: 18 }}>
            <IdeaReportEditor idea={idea} saving={saving} onSave={fields => save(idea.id, fields)} />
          </div>
        ))}
      </div>
    </div>
  );
}
