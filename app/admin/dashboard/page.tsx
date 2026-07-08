'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Trace, Sponsor, Route } from '@/lib/types';

type Tab = 'overview' | 'review' | 'traces' | 'sponsors' | 'routes';

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
}

export default function AdminDashboardPage() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const authHeaders = useCallback((): HeadersInit => {
    return { 'Content-Type': 'application/json', 'x-admin-password': password };
  }, [password]);

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
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <form
          onSubmit={e => { e.preventDefault(); tryUnlock(password); }}
          style={{ background: '#fff', padding: 24, borderRadius: 16, width: 320, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
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
            ['overview', '概要'],
            ['review', '承認待ち'],
            ['traces', '投稿管理'],
            ['sponsors', 'スポンサー'],
            ['routes', 'ルート'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '9px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: tab === id ? '#38ADA9' : '#fff',
              color: tab === id ? '#fff' : '#666',
              fontWeight: 700, fontSize: 13,
              boxShadow: tab === id ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            }}>{label}</button>
          ))}
        </nav>

        {tab === 'overview' && <OverviewTab authHeaders={authHeaders} />}
        {tab === 'review' && <ReviewTab authHeaders={authHeaders} />}
        {tab === 'traces' && <TracesTab authHeaders={authHeaders} />}
        {tab === 'sponsors' && <SponsorsTab authHeaders={authHeaders} />}
        {tab === 'routes' && <RoutesTab authHeaders={authHeaders} />}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {children}
    </div>
  );
}

// ── 概要 ──────────────────────────────────
function OverviewTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setStats(d.stats); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'));
  }, [authHeaders]);

  if (error) return <p style={{ color: '#E74C3C' }}>{error}</p>;
  if (!stats) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const items: [string, number, string][] = [
    ['総投稿数', stats.totalTraces, '📍'],
    ['承認待ち', stats.pendingReview, '⏳'],
    ['直近7日の投稿', stats.last7Days, '📈'],
    ['登録ユーザー', stats.profileCount, '👤'],
    ['公開ルート', stats.routeCount, '🧭'],
    ['稼働中スポンサー', stats.activeSponsors, '🏷'],
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {items.map(([label, value, emoji]) => (
        <Card key={label}>
          <div style={{ fontSize: 22 }}>{emoji}</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{value}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{label}</div>
        </Card>
      ))}
    </div>
  );
}

// ── 承認待ち ──────────────────────────────
function ReviewTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                {t.why && <p style={{ fontSize: 13, color: '#555', margin: '0 0 6px' }}>{t.why}</p>}
                <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
                  {t.nickname ?? '匿名'} ・ {new Date(t.created_at).toLocaleString('ja-JP')} ・ {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}
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
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', borderRadius: 10, padding: '10px 12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              opacity: t.is_deleted ? 0.55 : 1,
            }}>
              {t.photo_url && <img src={t.photo_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>
                  {t.visibility} ・ {new Date(t.created_at).toLocaleDateString('ja-JP')}
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
function RoutesTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');

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

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {routes.length === 0 && <p style={{ color: '#aaa' }}>公開中のルートはありません。</p>}
        {routes.map(r => (
          <Card key={r.id}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>{r.title}</p>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#999' }}>
              {r.trace_ids.length}地点 ・ {new Date(r.created_at).toLocaleDateString('ja-JP')}
              {r.sponsor_name && ` ・ 協賛：${r.sponsor_name}`}
            </p>
            {editingId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                padding: '6px 12px', borderRadius: 8, border: '1px solid #eee',
                background: '#fff', color: '#38ADA9', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>協賛を設定</button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
