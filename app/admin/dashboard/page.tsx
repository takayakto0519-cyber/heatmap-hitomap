'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { Trace, Sponsor, Route } from '@/lib/types';
import { EMOTIONS, getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';

const LocationPickerMap = dynamic(() => import('@/components/form/LocationPickerMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa', fontSize: 12 }}>地図を読み込み中…</div>,
});

type Tab = 'overview' | 'review' | 'traces' | 'reports' | 'sponsors' | 'routes' | 'quests' | 'users' | 'events';

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

interface Stats {
  totalTraces: number;
  pendingReview: number;
  last7Days: number;
  profileCount: number;
  routeCount: number;
  activeSponsors: number;
  pendingReports: number;
}

interface Report {
  id: string;
  trace_id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  trace: { id: string; title: string; photo_url: string | null; is_deleted: boolean } | null;
}

interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  traceCount: number;
  lastPostedAt: string | null;
  followerCount: number;
  followingCount: number;
}

// 投稿の「誰が」を表示するため、user_id→プロフィールの対応表を1回だけ取得して使い回す
function useAuthorMap(authHeaders: () => HeadersInit) {
  const [authorMap, setAuthorMap] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  useEffect(() => {
    fetch('/api/admin/profiles', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const map: Record<string, { username: string; avatar_url: string | null }> = {};
        for (const u of d.users as AdminUser[]) map[u.id] = { username: u.username, avatar_url: u.avatar_url };
        setAuthorMap(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return authorMap;
}

// 投稿カードの「誰が」表示（アカウント投稿はアイコン+ユーザー名、匿名投稿はニックネーム）
function AuthorLine({ trace, authorMap }: { trace: Trace; authorMap: Record<string, { username: string; avatar_url: string | null }> }) {
  if (trace.user_id) {
    const author = authorMap[trace.user_id];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
        ) : '👤'}
        {author ? `@${author.username}` : 'ログインユーザー'}
      </span>
    );
  }
  return <span>🕶 {trace.nickname ?? '匿名'}</span>;
}

// 投稿内容が一目でわかるタグ行（感情・カテゴリ・動画有無）
function ContentTags({ trace }: { trace: Trace }) {
  const emotion = getEmotion(trace.emotion_key);
  const category = getCategory(trace.category);
  if (!emotion && !category && !trace.video_url) return null;
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '4px 0' }}>
      {emotion && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: emotion.color + '22', color: emotion.color, fontSize: 11, fontWeight: 700 }}>
          {emotion.emoji} {emotion.label}
        </span>
      )}
      {category && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: '#f0f0f0', color: '#666', fontSize: 11 }}>
          {category.emoji} {category.label}
        </span>
      )}
      {trace.video_url && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: '#EEF4FF', color: '#4A90E2', fontSize: 11, fontWeight: 700 }}>🎥 動画</span>
      )}
    </div>
  );
}

const REASON_LABELS: Record<string, string> = {
  inappropriate: '不適切な内容',
  spam: 'スパム・宣伝',
  personal_info: '個人情報が写っている',
  copyright: '著作権・肖像権の侵害',
  other: 'その他',
};

export default function AdminDashboardPage() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [badgeCounts, setBadgeCounts] = useState<{ pendingReview: number; pendingReports: number } | null>(null);

  const authHeaders = useCallback((): HeadersInit => {
    return { 'Content-Type': 'application/json', 'x-admin-password': password };
  }, [password]);

  // ナビのタブに未処理件数バッジを出すため、タブ切替のたびに軽量に取り直す（対応後すぐ数字が減るように）
  useEffect(() => {
    if (!unlocked) return;
    fetch('/api/admin/stats', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setBadgeCounts({ pendingReview: d.stats.pendingReview, pendingReports: d.stats.pendingReports }); })
      .catch(() => {});
  }, [unlocked, tab, authHeaders]);

  async function tryUnlock(pw: string) {
    setUnlocking(true);
    setUnlockError('');
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'x-admin-password': pw } });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? '合言葉が違います');
      setUnlocked(true);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : '認証に失敗しました');
    } finally {
      setUnlocking(false);
    }
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', padding: 16, boxSizing: 'border-box' }}>
        <form
          onSubmit={e => { e.preventDefault(); tryUnlock(password); }}
          style={{ background: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 320, boxSizing: 'border-box', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>運営ダッシュボード（合言葉）</h1>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="合言葉" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
          />
          {unlockError && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 8px' }}>{unlockError}</p>}
          <button type="submit" disabled={unlocking} style={{
            width: '100%', padding: 10, borderRadius: 8, border: 'none',
            background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>{unlocking ? '確認中…' : '入る'}</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f5f5f5' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 60px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>🛠 運営ダッシュボード</h1>

        <nav style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {([
            ['overview', '概要', 0],
            ['review', '承認待ち', badgeCounts?.pendingReview ?? 0],
            ['traces', '投稿管理', 0],
            ['reports', '通報', badgeCounts?.pendingReports ?? 0],
            ['users', '登録ユーザー', 0],
            ['sponsors', 'スポンサー', 0],
            ['routes', 'ルート', 0],
            ['quests', 'クエスト', 0],
            ['events', 'イベント計画', 0],
          ] as [Tab, string, number][]).map(([id, label, count]) => {
            const urgent = count > 0 && tab !== id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: '9px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: tab === id ? '#38ADA9' : urgent ? '#FFF0EE' : '#fff',
                color: tab === id ? '#fff' : urgent ? '#E55039' : '#666',
                fontWeight: 700, fontSize: 13,
                boxShadow: tab === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
              }}>
                {label}
                {count > 0 && (
                  <span style={{
                    marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 11,
                    background: tab === id ? 'rgba(255,255,255,0.3)' : '#E55039', color: '#fff',
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {tab === 'overview' && <OverviewTab authHeaders={authHeaders} />}
        {tab === 'review' && <ReviewTab authHeaders={authHeaders} />}
        {tab === 'traces' && <TracesTab authHeaders={authHeaders} />}
        {tab === 'reports' && <ReportsTab authHeaders={authHeaders} />}
        {tab === 'users' && <UsersTab authHeaders={authHeaders} />}
        {tab === 'sponsors' && <SponsorsTab authHeaders={authHeaders} />}
        {tab === 'routes' && <RoutesTab authHeaders={authHeaders} />}
        {tab === 'quests' && <QuestsTab authHeaders={authHeaders} />}
        {tab === 'events' && <EventPlansTab authHeaders={authHeaders} />}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}

// ── 概要 ──────────────────────────────────
function OverviewTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'geojson' | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setStats(d.stats); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'));
  }, [authHeaders]);

  async function exportData(format: 'csv' | 'geojson') {
    setExporting(format);
    try {
      const res = await fetch(`/api/admin/export?format=${format}`, { headers: authHeaders() });
      if (!res.ok) { setError('書き出しに失敗しました'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `hitomap_traces_${stamp}.${format === 'geojson' ? 'geojson' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  }

  if (error) return <p style={{ color: '#E74C3C' }}>{error}</p>;
  if (!stats) return <p style={{ color: '#999' }}>読み込み中…</p>;

  // 承認待ち・未処理の通報は「対応が必要な状態」なので、0件でなければ視覚的に目立たせる
  const items: [string, number, string, boolean][] = [
    ['総投稿数', stats.totalTraces, '📍', false],
    ['承認待ち', stats.pendingReview, '⏳', stats.pendingReview > 0],
    ['直近7日の投稿', stats.last7Days, '📈', false],
    ['登録ユーザー', stats.profileCount, '👤', false],
    ['公開ルート', stats.routeCount, '🧭', false],
    ['稼働中スポンサー', stats.activeSponsors, '🏷', false],
    ['未処理の通報', stats.pendingReports, '⚠', stats.pendingReports > 0],
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        {items.map(([label, value, emoji, urgent]) => (
          <Card key={label} style={urgent ? { background: '#FFF5F3', boxShadow: '0 1px 4px rgba(229,80,57,0.15)', border: '1px solid #FFD9D0' } : undefined}>
            <div style={{ fontSize: 22 }}>{emoji}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: urgent ? '#E55039' : '#222' }}>{value}</div>
            <div style={{ fontSize: 12, color: urgent ? '#E55039' : '#888', marginTop: 2, fontWeight: urgent ? 700 : 400 }}>{label}</div>
          </Card>
        ))}
      </div>

      <Card style={{ marginTop: 16 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>📤 データ書き出し</p>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#999' }}>全国公開済みの投稿のみを対象に書き出します（審査待ち・非公開・削除済みは含みません）。</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportData('csv')} disabled={exporting !== null} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid #ddd',
            background: '#fff', color: '#555', fontWeight: 700, fontSize: 13,
            cursor: exporting ? 'wait' : 'pointer',
          }}>{exporting === 'csv' ? '書き出し中…' : 'CSVを書き出す'}</button>
          <button onClick={() => exportData('geojson')} disabled={exporting !== null} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, border: '1.5px solid #ddd',
            background: '#fff', color: '#555', fontWeight: 700, fontSize: 13,
            cursor: exporting ? 'wait' : 'pointer',
          }}>{exporting === 'geojson' ? '書き出し中…' : 'GeoJSONを書き出す'}</button>
        </div>
      </Card>
    </div>
  );
}

// ── 承認待ち ──────────────────────────────
function ReviewTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const authorMap = useAuthorMap(authHeaders);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/traces?status=pending_review', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setTraces(d.traces); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function review(id: string, action: 'approve' | 'reject') {
    const res = await fetch(`/api/admin/traces/${id}/review`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.ok) setTraces(prev => prev.filter(t => t.id !== id));
    else setError(data.error ?? '処理に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>全国公開の申請 {traces.length}件</p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {traces.length === 0 && <p style={{ color: '#aaa' }}>審査待ちの投稿はありません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {traces.map(t => (
          <Card key={t.id}>
            <div style={{ display: 'flex', gap: 10 }}>
              {t.photo_url && (
                <img src={t.photo_url} alt={t.title} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{t.title}</p>
                <ContentTags trace={t} />
                {t.why && <p style={{ fontSize: 13, color: '#555', margin: '0 0 6px' }}>{t.why}</p>}
                <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
                  <AuthorLine trace={t} authorMap={authorMap} /> ・ {new Date(t.created_at).toLocaleString('ja-JP')} ・ {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => review(t.id, 'approve')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                background: '#27AE60', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>承認（全国公開）</button>
              <button onClick={() => review(t.id, 'reject')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', fontWeight: 700, cursor: 'pointer',
              }}>却下（非公開に戻す）</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 投稿管理 ──────────────────────────────
function TracesTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [q, setQ] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const authorMap = useAuthorMap(authHeaders);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ status: 'all', limit: '100' });
    if (q.trim()) params.set('q', q.trim());
    if (showDeleted) params.set('include_deleted', 'true');
    fetch(`/api/admin/traces?${params}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setTraces(d.traces); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders, q, showDeleted]);

  useEffect(() => { load(); }, [load]);

  async function softDelete(id: string) {
    if (!confirm('この投稿を非公開（削除）にしますか？')) return;
    const res = await fetch(`/api/admin/traces/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  async function restore(id: string) {
    const res = await fetch(`/api/admin/traces/${id}`, { method: 'PATCH', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(); }}
          placeholder="タイトルで検索" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <button onClick={load} style={{ ...inputStyle, background: '#38ADA9', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>検索</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666' }}>
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} />
          削除済みも表示
        </label>
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {traces.length === 0 && <p style={{ color: '#aaa' }}>該当する投稿はありません。</p>}
          {traces.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#fff', borderRadius: 10, padding: '10px 12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              opacity: t.is_deleted ? 0.55 : 1,
            }}>
              {t.photo_url && <img src={t.photo_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                <ContentTags trace={t} />
                {t.why && (
                  <p style={{ margin: '2px 0 4px', fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.why}</p>
                )}
                <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                  <AuthorLine trace={t} authorMap={authorMap} /> ・ {t.visibility} ・ {new Date(t.created_at).toLocaleDateString('ja-JP')}
                  {t.is_deleted && ' ・ 削除済み'}
                </p>
              </div>
              {t.is_deleted ? (
                <button onClick={() => restore(t.id)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: '#EEF4FF', color: '#4A90E2', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>復元</button>
              ) : (
                <button onClick={() => softDelete(t.id)} style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: '#FFF0F0', color: '#E55039', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>削除</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 通報 ──────────────────────────────────
function ReportsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [status, setStatus] = useState<'pending' | 'all'>('pending');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/reports?status=${status}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setReports(d.reports); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders, status]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: 'dismiss' | 'action') {
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '処理に失敗しました');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['pending', '未処理'], ['all', 'すべて']] as [typeof status, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setStatus(id)} style={{
            padding: '7px 14px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: status === id ? '#E55039' : '#fff',
            color: status === id ? '#fff' : '#666', fontWeight: 700, fontSize: 12,
            boxShadow: status === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
          }}>{label}</button>
        ))}
      </div>

      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.length === 0 && <p style={{ color: '#aaa' }}>該当する通報はありません。</p>}
          {reports.map(r => (
            <Card key={r.id}>
              <div style={{ display: 'flex', gap: 10 }}>
                {r.trace?.photo_url && (
                  <img src={r.trace.photo_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>
                    {r.trace?.title ?? '（投稿が見つかりません）'}
                    {r.trace?.is_deleted && <span style={{ color: '#aaa', fontWeight: 400 }}> ・ 削除済み</span>}
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: 12, color: '#E55039', fontWeight: 700 }}>
                    {REASON_LABELS[r.reason] ?? r.reason}
                  </p>
                  {r.note && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#555' }}>{r.note}</p>}
                  <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                    {new Date(r.created_at).toLocaleString('ja-JP')} ・ ステータス：{r.status}
                  </p>
                </div>
              </div>
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => act(r.id, 'dismiss')} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', fontWeight: 700, cursor: 'pointer',
                  }}>却下</button>
                  <button onClick={() => act(r.id, 'action')} style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    background: '#E55039', color: '#fff', fontWeight: 700, cursor: 'pointer',
                  }}>投稿を削除</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── スポンサー管理 ────────────────────────
function SponsorsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ placement: 'region', region: '', name: '', message: '', url: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/sponsors', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setSponsors(d.sponsors); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createSponsor(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/sponsors', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          placement: form.placement, region: form.region || null,
          name: form.name, message: form.message || null, url: form.url || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setForm({ placement: 'region', region: '', name: '', message: '', url: '' });
        setShowForm(false);
        load();
      } else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Sponsor) {
    const res = await fetch(`/api/admin/sponsors/${s.id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function removeSponsor(id: string) {
    if (!confirm('このスポンサー枠を削除しますか？')) return;
    const res = await fetch(`/api/admin/sponsors/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  return (
    <div>
      <button onClick={() => setShowForm(v => !v)} style={{
        padding: '9px 16px', borderRadius: 8, border: 'none', marginBottom: 14,
        background: '#FF6B9D', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
      }}>{showForm ? '閉じる' : '＋ 新しいスポンサー枠を追加'}</button>

      {showForm && (
        <Card>
          <form onSubmit={createSponsor} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={form.placement} onChange={e => setForm(f => ({ ...f, placement: e.target.value }))} style={inputStyle}>
              <option value="region">region（自治体ページ）</option>
              <option value="detour">detour（寄り道モード）</option>
            </select>
            <input placeholder="対象の自治体名（regionの場合）" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} style={inputStyle} />
            <input placeholder="スポンサー名 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} required />
            <input placeholder="メッセージ" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={inputStyle} />
            <input placeholder="リンクURL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} style={inputStyle} />
            <button type="submit" disabled={saving} style={{
              padding: '9px 0', borderRadius: 8, border: 'none',
              background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
            }}>{saving ? '作成中…' : '作成する'}</button>
          </form>
        </Card>
      )}

      {error && <p style={{ color: '#E74C3C', fontSize: 13, marginTop: 10 }}>{error}</p>}
      {loading ? <p style={{ color: '#999', marginTop: 10 }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {sponsors.length === 0 && <p style={{ color: '#aaa' }}>登録されたスポンサー枠はありません。</p>}
          {sponsors.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', borderRadius: 10, padding: '10px 12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', opacity: s.is_active ? 1 : 0.5,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{s.name}
                  <span style={{ fontWeight: 400, color: '#aaa', fontSize: 11 }}> ・ {s.placement}{s.region ? ` ・ ${s.region}` : ''}</span>
                </p>
                {s.message && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#666' }}>{s.message}</p>}
              </div>
              <button onClick={() => toggleActive(s)} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: s.is_active ? '#FFF3CD' : '#E8F8F7',
                color: s.is_active ? '#856404' : '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{s.is_active ? '停止する' : '再開する'}</button>
              <button onClick={() => removeSponsor(s.id)} style={{
                padding: '6px 10px', borderRadius: 8, border: 'none',
                background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
              }}>削除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ルート管理 ────────────────────────────
// datetime-local入力用：ISO文字列 ⇄ "YYYY-MM-DDTHH:mm" の相互変換
function isoToInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function inputValueToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface EventFieldsForm {
  event_slug: string;
  event_cover_url: string;
  event_starts_at: string;
  event_ends_at: string;
  event_area: string;
  event_mode: 'route' | 'relay';
  event_session_code: string;
  event_start_lat: number | null;
  event_start_lng: number | null;
  event_start_label: string;
  event_end_lat: number | null;
  event_end_lng: number | null;
  event_end_label: string;
}

const emptyEventFields: EventFieldsForm = {
  event_slug: '', event_cover_url: '', event_starts_at: '', event_ends_at: '', event_area: '',
  event_mode: 'route', event_session_code: '',
  event_start_lat: null, event_start_lng: null, event_start_label: '',
  event_end_lat: null, event_end_lng: null, event_end_label: '',
};

interface RelayCreateForm {
  title: string;
  description: string;
  event_session_code: string;
  event_slug: string;
  event_cover_url: string;
  event_area: string;
  event_starts_at: string;
  event_ends_at: string;
  event_start_lat: number | null;
  event_start_lng: number | null;
  event_start_label: string;
  event_end_lat: number | null;
  event_end_lng: number | null;
  event_end_label: string;
}

const emptyRelayForm: RelayCreateForm = {
  title: '', description: '', event_session_code: '', event_slug: '', event_cover_url: '',
  event_area: '', event_starts_at: '', event_ends_at: '',
  event_start_lat: null, event_start_lng: null, event_start_label: '',
  event_end_lat: null, event_end_lng: null, event_end_label: '',
};

// スタート/ゴール地点ピッカー：地図タップで座標を決め、ラベルを添える（イベントページのRouteMap/TraceMapに反映される）
function StartEndPicker({ kind, lat, lng, label, onChange }: {
  kind: 'start' | 'end';
  lat: number | null; lng: number | null; label: string;
  onChange: (v: { lat: number | null; lng: number | null; label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const emoji = kind === 'start' ? '🚩' : '🏁';
  const title = kind === 'start' ? 'スタート地点' : 'ゴール地点';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 6 : 0 }}>
        <button type="button" onClick={() => setOpen(v => !v)} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
          border: `1.5px solid ${lat != null ? (kind === 'start' ? '#27AE60' : '#E55039') : '#ddd'}`,
          background: lat != null ? (kind === 'start' ? '#E8F8F1' : '#FFF0F0') : '#fff',
          color: lat != null ? (kind === 'start' ? '#27AE60' : '#E55039') : '#888', fontWeight: 700,
        }}>
          {emoji} {title}{lat != null ? '設定済み' : '未設定'} {open ? '▴' : '▾'}
        </button>
        {lat != null && (
          <button type="button" onClick={() => onChange({ lat: null, lng: null, label: '' })} style={{
            background: 'none', border: 'none', color: '#ccc', fontSize: 11, cursor: 'pointer',
          }}>解除</button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 6 }}>
          <input placeholder={`${title}の名前（例：渋谷駅ハチ公口）`} value={label}
            onChange={e => onChange({ lat, lng, label: e.target.value })}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 6 }} />
          <div style={{ height: 200, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
            <LocationPickerMap
              lat={lat ?? 35.681236} lng={lng ?? 139.767125}
              onChange={(la, ln) => onChange({ lat: la, lng: ln, label })}
            />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#aaa' }}>地図をタップして{title}を指定してください</p>
        </div>
      )}
    </div>
  );
}

function RoutesTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [eventEditingId, setEventEditingId] = useState<string | null>(null);
  const [eventFields, setEventFields] = useState<EventFieldsForm>(emptyEventFields);
  const [eventSaving, setEventSaving] = useState(false);
  const [showRelayCreate, setShowRelayCreate] = useState(false);
  const [relayForm, setRelayForm] = useState<RelayCreateForm>(emptyRelayForm);
  const [relaySaving, setRelaySaving] = useState(false);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [routeTraces, setRouteTraces] = useState<Record<string, Trace[]>>({});
  const [routeTracesLoading, setRouteTracesLoading] = useState<string | null>(null);

  async function toggleExpand(id: string) {
    if (expandedRouteId === id) { setExpandedRouteId(null); return; }
    setExpandedRouteId(id);
    if (!routeTraces[id]) {
      setRouteTracesLoading(id);
      try {
        const res = await fetch(`/api/routes/${id}`).then(r => r.json());
        if (res.ok) setRouteTraces(prev => ({ ...prev, [id]: res.traces ?? [] }));
      } finally {
        setRouteTracesLoading(null);
      }
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/routes')
      .then(r => r.json())
      .then(d => { if (d.ok) setRoutes(d.routes); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(r: Route) {
    setEditingId(r.id);
    setSponsorName(r.sponsor_name ?? '');
    setSponsorUrl(r.sponsor_url ?? '');
  }

  async function saveSponsor(id: string) {
    const res = await fetch(`/api/admin/routes/${id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ sponsor_name: sponsorName || null, sponsor_url: sponsorUrl || null }),
    });
    const data = await res.json();
    if (data.ok) { setEditingId(null); load(); } else setError(data.error ?? '更新に失敗しました');
  }

  function startEventEdit(r: Route) {
    setEventEditingId(r.id);
    setEventFields({
      event_slug: r.event_slug ?? '',
      event_cover_url: r.event_cover_url ?? '',
      event_starts_at: isoToInputValue(r.event_starts_at),
      event_ends_at: isoToInputValue(r.event_ends_at),
      event_area: r.event_area ?? '',
      event_mode: r.event_mode === 'relay' ? 'relay' : 'route',
      event_session_code: r.event_session_code ?? '',
      event_start_lat: r.event_start_lat, event_start_lng: r.event_start_lng, event_start_label: r.event_start_label ?? '',
      event_end_lat: r.event_end_lat, event_end_lng: r.event_end_lng, event_end_label: r.event_end_label ?? '',
    });
  }

  async function saveEventFields(id: string) {
    setEventSaving(true);
    try {
      const res = await fetch(`/api/admin/routes/${id}`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          event_slug: eventFields.event_slug.trim() || null,
          event_cover_url: eventFields.event_cover_url.trim() || null,
          event_starts_at: inputValueToIso(eventFields.event_starts_at),
          event_ends_at: inputValueToIso(eventFields.event_ends_at),
          event_area: eventFields.event_area.trim() || null,
          event_mode: eventFields.event_mode,
          event_session_code: eventFields.event_mode === 'relay' ? (eventFields.event_session_code.trim() || null) : null,
          event_start_lat: eventFields.event_start_lat, event_start_lng: eventFields.event_start_lng,
          event_start_label: eventFields.event_start_label.trim() || null,
          event_end_lat: eventFields.event_end_lat, event_end_lng: eventFields.event_end_lng,
          event_end_label: eventFields.event_end_label.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) { setEventEditingId(null); load(); } else setError(data.error ?? '更新に失敗しました');
    } finally {
      setEventSaving(false);
    }
  }

  async function createRelayEvent() {
    if (!relayForm.title.trim()) { setError('タイトルは必須です'); return; }
    setRelaySaving(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: relayForm.title.trim(),
          description: relayForm.description.trim() || null,
          trace_ids: [],
          event_mode: 'relay',
          event_session_code: relayForm.event_session_code.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? '作成に失敗しました'); return; }

      // 続けて event_slug 等の公開情報を設定
      const patchRes = await fetch(`/api/admin/routes/${data.route.id}`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          event_slug: relayForm.event_slug.trim() || null,
          event_cover_url: relayForm.event_cover_url.trim() || null,
          event_area: relayForm.event_area.trim() || null,
          event_starts_at: inputValueToIso(relayForm.event_starts_at),
          event_ends_at: inputValueToIso(relayForm.event_ends_at),
          event_start_lat: relayForm.event_start_lat, event_start_lng: relayForm.event_start_lng,
          event_start_label: relayForm.event_start_label.trim() || null,
          event_end_lat: relayForm.event_end_lat, event_end_lng: relayForm.event_end_lng,
          event_end_label: relayForm.event_end_label.trim() || null,
        }),
      });
      const patchData = await patchRes.json();
      if (!patchData.ok) { setError(patchData.error ?? '公開情報の設定に失敗しました'); }

      setShowRelayCreate(false);
      setRelayForm(emptyRelayForm);
      load();
    } finally {
      setRelaySaving(false);
    }
  }

  async function reviewRoute(id: string, status: 'approved' | 'rejected') {
    const res = await fetch(`/api/admin/routes/${id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ review_status: status }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const pendingRoutes = routes.filter(r => r.review_status === 'pending');

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      {pendingRoutes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 14, color: '#B7791F' }}>✨ おすすめルート承認待ち（{pendingRoutes.length}件）</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingRoutes.map(r => (
              <Card key={r.id} style={{ background: '#FFFAF0', border: '1px solid #F6E4B8' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>{r.title}</p>
                {r.description && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}>{r.description}</p>}
                {r.highlights && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#8E44AD', background: '#FBF6FF', padding: '8px 10px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                    👀 {r.highlights}
                  </p>
                )}
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#aaa' }}>{r.trace_ids.length}地点 ・ <a href={`/routes/${r.id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#8E44AD' }}>プレビュー ↗</a></p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => reviewRoute(r.id, 'approved')} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12,
                  }}>承認する</button>
                  <button onClick={() => reviewRoute(r.id, 'rejected')} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#E74C3C', cursor: 'pointer', fontSize: 12,
                  }}>却下する</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showRelayCreate ? (
        <Card>
          <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: '#38ADA9' }}>🏃 新規relayイベントを作成</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>タイトル</label>
            <input placeholder="例：ヒトマップ×山手線一周プロジェクト" value={relayForm.title}
              onChange={e => setRelayForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>説明文</label>
            <textarea placeholder="イベントの説明" value={relayForm.description} rows={3}
              onChange={e => setRelayForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>参加者投稿を束ねるコード（実験回コードとして参加者に案内）</label>
            <input placeholder="例：yamanote2026" value={relayForm.event_session_code}
              onChange={e => setRelayForm(f => ({ ...f, event_session_code: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>URL（英数字とハイフン）</label>
            <input placeholder="event_slug 例：yamanote-2026" value={relayForm.event_slug}
              onChange={e => setRelayForm(f => ({ ...f, event_slug: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>ヒーロー画像URL</label>
            <input placeholder="event_cover_url" value={relayForm.event_cover_url}
              onChange={e => setRelayForm(f => ({ ...f, event_cover_url: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>エリア名</label>
            <input placeholder="例：山手線" value={relayForm.event_area}
              onChange={e => setRelayForm(f => ({ ...f, event_area: e.target.value }))} style={inputStyle} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 11, color: '#666', fontWeight: 700, display: 'block' }}>開始</label>
                <input type="datetime-local" value={relayForm.event_starts_at}
                  onChange={e => setRelayForm(f => ({ ...f, event_starts_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 11, color: '#666', fontWeight: 700, display: 'block' }}>終了</label>
                <input type="datetime-local" value={relayForm.event_ends_at}
                  onChange={e => setRelayForm(f => ({ ...f, event_ends_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>
              スタート・ゴール地点（ルート未定でも、地図で場所だけ先に決められます）
            </label>
            <StartEndPicker kind="start"
              lat={relayForm.event_start_lat} lng={relayForm.event_start_lng} label={relayForm.event_start_label}
              onChange={v => setRelayForm(f => ({ ...f, event_start_lat: v.lat, event_start_lng: v.lng, event_start_label: v.label }))} />
            <StartEndPicker kind="end"
              lat={relayForm.event_end_lat} lng={relayForm.event_end_lng} label={relayForm.event_end_label}
              onChange={v => setRelayForm(f => ({ ...f, event_end_lat: v.lat, event_end_lng: v.lng, event_end_label: v.label }))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={createRelayEvent} disabled={relaySaving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: relaySaving ? 'wait' : 'pointer', fontSize: 13,
              }}>{relaySaving ? '作成中…' : '作成する'}</button>
              <button onClick={() => { setShowRelayCreate(false); setRelayForm(emptyRelayForm); }} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowRelayCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 12,
        }}>＋ 新規relayイベントを作成</button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {routes.length === 0 && <p style={{ color: '#aaa' }}>公開中のルートはありません。</p>}
        {routes.map(r => (
          <Card key={r.id}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>{r.title}</p>
            {r.description && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#666' }}>{r.description}</p>}
            {r.highlights && (
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#8E44AD', background: '#FBF6FF', padding: '6px 9px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
                👀 {r.highlights}
              </p>
            )}
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>
              {r.trace_ids.length}地点 ・ {new Date(r.created_at).toLocaleDateString('ja-JP')}
              {r.sponsor_name && ` ・ 協賛：${r.sponsor_name}`}
              {r.review_status === 'approved' && <span style={{ color: '#38ADA9', fontWeight: 700 }}> ・ ✨承認済み</span>}
              {r.review_status === 'rejected' && <span style={{ color: '#E74C3C', fontWeight: 700 }}> ・ 却下済み</span>}
            </p>
            {r.trace_ids.length > 0 && (
              <button onClick={() => toggleExpand(r.id)} style={{
                background: 'none', border: 'none', color: '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 8,
              }}>
                {expandedRouteId === r.id ? '▴ 地点を閉じる' : '▾ 地点の中身を見る'}
              </button>
            )}
            {expandedRouteId === r.id && (
              <div style={{ marginBottom: 8, paddingLeft: 4, borderLeft: '2px solid #eee' }}>
                {routeTracesLoading === r.id ? (
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>読み込み中…</p>
                ) : (routeTraces[r.id] ?? []).length === 0 ? (
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>地点データがありません。</p>
                ) : (
                  (routeTraces[r.id] ?? []).map((t, i) => (
                    <p key={t.id} style={{ margin: '2px 0', fontSize: 12, color: '#555', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#bbb' }}>{i + 1}.</span>
                      {t.photo_url && <img src={t.photo_url} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover' }} />}
                      {t.title}
                      {getEmotion(t.emotion_key) && <span>{getEmotion(t.emotion_key)!.emoji}</span>}
                    </p>
                  ))
                )}
              </div>
            )}
            {r.event_slug && (
              <p style={{ margin: '0 0 8px', fontSize: 12 }}>
                <a href={`/events/${r.event_slug}`} target="_blank" rel="noopener noreferrer" style={{ color: r.event_mode === 'relay' ? '#38ADA9' : '#8E44AD', fontWeight: 700 }}>
                  {r.event_mode === 'relay' ? '🏃 relay' : '🎪 route'} ・ /events/{r.event_slug} を公開中 ↗
                </a>
                {r.event_mode === 'relay' && r.event_session_code && (
                  <span style={{ marginLeft: 8, color: '#999' }}>コード: {r.event_session_code}</span>
                )}
              </p>
            )}

            {editingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <input placeholder="協賛企業名" value={sponsorName} onChange={e => setSponsorName(e.target.value)} style={inputStyle} />
                <input placeholder="協賛企業URL" value={sponsorUrl} onChange={e => setSponsorUrl(e.target.value)} style={inputStyle} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveSponsor(r.id)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12,
                  }}>保存</button>
                  <button onClick={() => setEditingId(null)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
                  }}>キャンセル</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEdit(r)} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #eee', marginRight: 8, marginBottom: 8,
                background: '#fff', color: '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>協賛を設定</button>
            )}

            {eventEditingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, padding: 10, background: '#FBF6FF', borderRadius: 8 }}>
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>イベント形式</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEventFields(f => ({ ...f, event_mode: 'route' }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: eventFields.event_mode === 'route' ? '1.5px solid #8E44AD' : '1.5px solid #ddd',
                    background: eventFields.event_mode === 'route' ? '#8E44AD' : '#fff',
                    color: eventFields.event_mode === 'route' ? '#fff' : '#888',
                  }}>🚶 route（事前ルート型）</button>
                  <button onClick={() => setEventFields(f => ({ ...f, event_mode: 'relay' }))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    border: eventFields.event_mode === 'relay' ? '1.5px solid #38ADA9' : '1.5px solid #ddd',
                    background: eventFields.event_mode === 'relay' ? '#38ADA9' : '#fff',
                    color: eventFields.event_mode === 'relay' ? '#fff' : '#888',
                  }}>🏃 relay（発見連鎖型）</button>
                </div>
                {eventFields.event_mode === 'relay' && (
                  <>
                    <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>参加者投稿を束ねるコード（実験回コードとして案内）</label>
                    <input placeholder="例：yamanote2026" value={eventFields.event_session_code}
                      onChange={e => setEventFields(f => ({ ...f, event_session_code: e.target.value }))} style={inputStyle} />
                  </>
                )}
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>URL（英数字とハイフン、例: shibuya-2026）</label>
                <input placeholder="event_slug" value={eventFields.event_slug}
                  onChange={e => setEventFields(f => ({ ...f, event_slug: e.target.value }))} style={inputStyle} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>ヒーロー画像URL</label>
                <input placeholder="event_cover_url" value={eventFields.event_cover_url}
                  onChange={e => setEventFields(f => ({ ...f, event_cover_url: e.target.value }))} style={inputStyle} />
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>エリア名（例：渋谷、山手線）</label>
                <input placeholder="event_area" value={eventFields.event_area}
                  onChange={e => setEventFields(f => ({ ...f, event_area: e.target.value }))} style={inputStyle} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700, display: 'block' }}>開始</label>
                    <input type="datetime-local" value={eventFields.event_starts_at}
                      onChange={e => setEventFields(f => ({ ...f, event_starts_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700, display: 'block' }}>終了</label>
                    <input type="datetime-local" value={eventFields.event_ends_at}
                      onChange={e => setEventFields(f => ({ ...f, event_ends_at: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <label style={{ fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>
                  スタート・ゴール地点（ルート未定でも、地図で場所だけ先に決められます）
                </label>
                <StartEndPicker kind="start"
                  lat={eventFields.event_start_lat} lng={eventFields.event_start_lng} label={eventFields.event_start_label}
                  onChange={v => setEventFields(f => ({ ...f, event_start_lat: v.lat, event_start_lng: v.lng, event_start_label: v.label }))} />
                <StartEndPicker kind="end"
                  lat={eventFields.event_end_lat} lng={eventFields.event_end_lng} label={eventFields.event_end_label}
                  onChange={v => setEventFields(f => ({ ...f, event_end_lat: v.lat, event_end_lng: v.lng, event_end_label: v.label }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => saveEventFields(r.id)} disabled={eventSaving} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                    background: '#8E44AD', color: '#fff', fontWeight: 700, cursor: eventSaving ? 'wait' : 'pointer', fontSize: 12,
                  }}>{eventSaving ? '保存中…' : '保存してイベント公開'}</button>
                  <button onClick={() => setEventEditingId(null)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                    background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
                  }}>キャンセル</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEventEdit(r)} style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #eee',
                background: '#fff', color: '#8E44AD', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{r.event_slug ? 'イベント情報を編集' : '🎪 イベントとして公開'}</button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
interface Quest {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  quest_type: string;
  target_emotion_key: string | null;
  is_active: boolean;
  created_at: string;
}

interface QuestForm {
  emoji: string;
  title: string;
  hint: string;
  quest_type: 'search' | 'emotion';
  target_emotion_key: string;
}

const emptyQuestForm: QuestForm = { emoji: '', title: '', hint: '', quest_type: 'search', target_emotion_key: EMOTIONS[0]?.key ?? '' };

function QuestsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<QuestForm>(emptyQuestForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/quests', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setQuests(d.quests); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createQuest() {
    if (!form.emoji.trim() || !form.title.trim() || !form.hint.trim()) {
      setError('絵文字・タイトル・ヒントは必須です');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/quests', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          emoji: form.emoji.trim(), title: form.title.trim(), hint: form.hint.trim(),
          quest_type: form.quest_type,
          target_emotion_key: form.quest_type === 'emotion' ? form.target_emotion_key : null,
        }),
      });
      const data = await res.json();
      if (data.ok) { setShowCreate(false); setForm(emptyQuestForm); load(); }
      else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function activateQuest(id: string) {
    const res = await fetch(`/api/admin/quests/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active: true }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deactivateQuest(id: string) {
    const res = await fetch(`/api/admin/quests/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active: false }),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deleteQuest(id: string) {
    const res = await fetch(`/api/admin/quests/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const activeQuest = quests.find(q => q.is_active);

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        投稿画面のお題バナーに表示する内容です。「今すぐ表示」を1件だけ選べます。何も選ばれていない間は、曜日ローテーションの既定お題が自動で表示されます。
      </p>

      {activeQuest ? (
        <Card style={{ background: '#FBF6FF', border: '1px solid #F3EAFB', marginBottom: 16 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, color: '#8E44AD', fontWeight: 700 }}>✨ 現在表示中</p>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{activeQuest.emoji} {activeQuest.title}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{activeQuest.hint}</p>
        </Card>
      ) : (
        <p style={{ fontSize: 12, color: '#bbb', marginBottom: 16 }}>現在は既定のローテーションお題が表示されています。</p>
      )}

      {showCreate ? (
        <Card style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: '#8E44AD' }}>＋ 新しいお題を作成</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>種類</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setForm(f => ({ ...f, quest_type: 'search' }))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: form.quest_type === 'search' ? '1.5px solid #8E44AD' : '1.5px solid #ddd',
                background: form.quest_type === 'search' ? '#8E44AD' : '#fff',
                color: form.quest_type === 'search' ? '#fff' : '#888',
              }}>🔍 探すお題</button>
              <button onClick={() => setForm(f => ({ ...f, quest_type: 'emotion' }))} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                border: form.quest_type === 'emotion' ? '1.5px solid #FF6B9D' : '1.5px solid #ddd',
                background: form.quest_type === 'emotion' ? '#FF6B9D' : '#fff',
                color: form.quest_type === 'emotion' ? '#fff' : '#888',
              }}>💗 感情収集お題</button>
            </div>
            {form.quest_type === 'emotion' && (
              <>
                <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>集めたい感情</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {EMOTIONS.map(e => (
                    <button key={e.key} onClick={() => setForm(f => ({ ...f, target_emotion_key: e.key }))} style={{
                      padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      border: form.target_emotion_key === e.key ? `1.5px solid ${e.color}` : '1.5px solid #ddd',
                      background: form.target_emotion_key === e.key ? e.color + '22' : '#fff',
                      color: form.target_emotion_key === e.key ? e.color : '#888',
                    }}>{e.emoji} {e.label}</button>
                  ))}
                </div>
              </>
            )}
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>絵文字</label>
            <input placeholder="例：🌸" value={form.emoji}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} style={{ ...inputStyle, width: 80 }} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>タイトル</label>
            <input
              placeholder={form.quest_type === 'emotion' ? '例：あたたかさを集めています' : '例：直された跡を探そう'}
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>ヒント文</label>
            <textarea placeholder="投稿のきっかけになる一言" value={form.hint} rows={2}
              onChange={e => setForm(f => ({ ...f, hint: e.target.value }))} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={createQuest} disabled={saving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#8E44AD', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: 13,
              }}>{saving ? '作成中…' : '作成する'}</button>
              <button onClick={() => { setShowCreate(false); setForm(emptyQuestForm); }} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #8E44AD',
          background: '#fff', color: '#8E44AD', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 16,
        }}>＋ 新しいお題を作成</button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {quests.length === 0 && <p style={{ color: '#aaa' }}>まだお題がありません。</p>}
        {quests.map(q => (
          <Card key={q.id} style={q.is_active ? { border: '1.5px solid #8E44AD' } : undefined}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>
              {q.emoji} {q.title}
              {q.quest_type === 'emotion' && <span style={{ marginLeft: 6, fontSize: 11, color: '#FF6B9D', fontWeight: 700 }}>💗感情収集</span>}
            </p>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>{q.hint}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {q.is_active ? (
                <button onClick={() => deactivateQuest(q.id)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ddd',
                  background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
                }}>表示を止める</button>
              ) : (
                <button onClick={() => activateQuest(q.id)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                  background: '#8E44AD', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12,
                }}>今すぐ表示する</button>
              )}
              <button onClick={() => deleteQuest(q.id)} style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#E74C3C', cursor: 'pointer', fontSize: 12,
              }}>削除</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── 登録ユーザー ──────────────────────────
function UsersTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/profiles', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setUsers(d.users); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
        アカウント登録済みのユーザー {users.length}人（ヒトマップ本体の投稿・フォローと連携した実データです）
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {users.length === 0 && <p style={{ color: '#aaa' }}>登録ユーザーはまだいません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map(u => (
          <Card key={u.id}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: '#f0f0f0', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>👤</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                  {u.display_name ?? u.username}
                  <a href={`/profile/${u.username}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: 11, color: '#38ADA9', fontWeight: 400 }}>
                    @{u.username} ↗
                  </a>
                </p>
                {u.bio && <p style={{ margin: '2px 0', fontSize: 12, color: '#666' }}>{u.bio}</p>}
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                  📍{u.traceCount}件の投稿 ・ 👥フォロワー{u.followerCount} ・ フォロー中{u.followingCount}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#ccc' }}>
                  登録: {new Date(u.created_at).toLocaleDateString('ja-JP')}
                  {u.lastPostedAt && ` ・ 最終投稿: ${new Date(u.lastPostedAt).toLocaleDateString('ja-JP')}`}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── イベント計画 ──────────────────────────
interface EventPlan {
  id: string;
  title: string;
  memo: string | null;
  status: string;
  event_date: string | null;
  created_at: string;
  updated_at: string;
}

const EVENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea: { label: '💡 アイデア', color: '#8E44AD' },
  planning: { label: '📝 検討中', color: '#F6B93B' },
  confirmed: { label: '✅ 確定', color: '#38ADA9' },
  done: { label: '🏁 完了', color: '#aaa' },
};

function EventPlansTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [plans, setPlans] = useState<EventPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingMemo, setEditingMemo] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/event-plans', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setPlans(d.plans);
          const memoMap: Record<string, string> = {};
          for (const p of d.plans as EventPlan[]) memoMap[p.id] = p.memo ?? '';
          setEditingMemo(memoMap);
        } else setError(d.error ?? '取得に失敗しました');
      })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function createPlan() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/event-plans', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: newTitle.trim(), event_date: newDate || null }),
      });
      const data = await res.json();
      if (data.ok) { setNewTitle(''); setNewDate(''); setShowCreate(false); load(); }
      else setError(data.error ?? '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function updatePlan(id: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/admin/event-plans/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '更新に失敗しました');
  }

  async function deletePlan(id: string) {
    if (!confirm('このイベント計画を削除しますか？')) return;
    const res = await fetch(`/api/admin/event-plans/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) load(); else setError(data.error ?? '削除に失敗しました');
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px' }}>
        今後どんなイベントをやるか、協力者とここでメモを練っていくための計画表です。
      </p>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}

      {showCreate ? (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="イベント名（例：山手線一周・痕跡リレー）" value={newTitle}
              onChange={e => setNewTitle(e.target.value)} style={inputStyle} />
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createPlan} disabled={saving || !newTitle.trim()} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>{saving ? '作成中…' : '追加する'}</button>
              <button onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer',
              }}>キャンセル</button>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{
          display: 'block', width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px dashed #38ADA9',
          background: '#fff', color: '#38ADA9', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14,
        }}>＋ 新しいイベント案を追加</button>
      )}

      {plans.length === 0 && <p style={{ color: '#aaa' }}>まだイベント案がありません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map(p => {
          const statusInfo = EVENT_STATUS_LABELS[p.status] ?? EVENT_STATUS_LABELS.idea;
          return (
            <Card key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: 15 }}>
                    {p.title}
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
                  </p>
                  {p.event_date && <p style={{ margin: 0, fontSize: 12, color: '#999' }}>📅 {p.event_date}</p>}
                </div>
                <button onClick={() => deletePlan(p.id)} style={{
                  padding: '4px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#ccc', fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                {Object.entries(EVENT_STATUS_LABELS).map(([key, info]) => (
                  <button key={key} onClick={() => updatePlan(p.id, { status: key })} style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                    border: `1.5px solid ${p.status === key ? info.color : '#ddd'}`,
                    background: p.status === key ? info.color + '18' : '#fff',
                    color: p.status === key ? info.color : '#999', fontWeight: p.status === key ? 700 : 400,
                  }}>{info.label}</button>
                ))}
              </div>

              <textarea
                value={editingMemo[p.id] ?? ''}
                onChange={e => setEditingMemo(prev => ({ ...prev, [p.id]: e.target.value }))}
                onBlur={() => { if ((editingMemo[p.id] ?? '') !== (p.memo ?? '')) updatePlan(p.id, { memo: editingMemo[p.id] || null }); }}
                placeholder="協力者と練っているメモ（会場案・企画内容・TODOなど自由に）"
                rows={4}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 10, color: '#ccc' }}>
                最終更新: {new Date(p.updated_at).toLocaleString('ja-JP')}（欄外をタップすると自動保存されます）
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
