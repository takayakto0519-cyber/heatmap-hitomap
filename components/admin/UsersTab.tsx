'use client';

// 登録ユーザー：会員の投稿履歴を確認。page.tsx monolith分割で切り出し。
import { useEffect, useState } from 'react';
import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';
import { Card, inputStyle, VISIBILITY_LABELS, type AdminUser } from '@/components/admin/adminShared';

export default function UsersTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'traces' | 'recent' | 'new'>('traces');
  const [q, setQ] = useState('');
  const [fullTraces, setFullTraces] = useState<Record<string, Trace[]>>({});
  const [loadingFull, setLoadingFull] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/admin/profiles', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setUsers(d.users); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function toggleAutoApprove(id: string, next: boolean) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, auto_approve: next } : u));
    const res = await fetch(`/api/admin/profiles/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ auto_approve: next }),
    });
    const data = await res.json();
    if (!data.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, auto_approve: !next } : u));
      setError(data.error ?? '更新に失敗しました');
    }
  }

  async function loadAllTraces(userId: string) {
    setLoadingFull(prev => new Set(prev).add(userId));
    try {
      const res = await fetch(`/api/admin/traces?status=all&user_id=${userId}&limit=1000`, { headers: authHeaders() })
        .then(r => r.json());
      if (res.ok) setFullTraces(prev => ({ ...prev, [userId]: res.traces }));
    } finally {
      setLoadingFull(prev => { const next = new Set(prev); next.delete(userId); return next; });
    }
  }

  if (loading) return <p style={{ color: '#999' }}>読み込み中…</p>;

  const filtered = users.filter(u => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return u.username.toLowerCase().includes(needle) || (u.display_name ?? '').toLowerCase().includes(needle);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'traces') return b.traceCount - a.traceCount;
    if (sortBy === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    // 'recent'：最終投稿が新しい人を先に（未投稿は最後）
    if (!a.lastPostedAt) return 1;
    if (!b.lastPostedAt) return -1;
    return new Date(b.lastPostedAt).getTime() - new Date(a.lastPostedAt).getTime();
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
          登録ユーザー {users.length}人（投稿・フォローと連携した実データ）
        </p>
        <div style={{ flex: 1 }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ユーザー名で検索"
          style={{ ...inputStyle, width: 160 }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={inputStyle}>
          <option value="traces">投稿数順</option>
          <option value="recent">最終投稿が新しい順</option>
          <option value="new">登録が新しい順</option>
        </select>
      </div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {sorted.length === 0 && <p style={{ color: '#aaa' }}>該当するユーザーはいません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(u => {
          const isOpen = expanded.has(u.id);
          return (
            <Card key={u.id}>
              <button onClick={() => toggle(u.id)} style={{
                display: 'flex', gap: 10, alignItems: 'center', width: '100%',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
              }}>
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
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#999', fontWeight: 400 }}>@{u.username}</span>
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
                {u.traceCount > 0 && (
                  <span style={{ fontSize: 18, color: '#ccc', flexShrink: 0 }}>{isOpen ? '▴' : '▾'}</span>
                )}
              </button>

              <button onClick={() => toggleAutoApprove(u.id, !u.auto_approve)} title="今後の投稿を審査なしで即座に全国公開する" style={{
                marginTop: 8, padding: '5px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${u.auto_approve ? '#27AE60' : '#ddd'}`,
                background: u.auto_approve ? '#E8F8F1' : '#fff',
                color: u.auto_approve ? '#27AE60' : '#999',
              }}>{u.auto_approve ? '✓ 自動承認 ON' : '自動承認 OFF'}</button>

              {isOpen && u.recentTraces.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#aaa', fontWeight: 700 }}>
                      {fullTraces[u.id]
                        ? `全投稿（${fullTraces[u.id].length}件・非公開/審査待ち含む）`
                        : `直近の投稿（最大${u.recentTraces.length}件${u.traceCount > u.recentTraces.length ? `・全${u.traceCount}件中` : ''}）`}
                    </p>
                    {!fullTraces[u.id] && u.traceCount > u.recentTraces.length && (
                      <button onClick={() => loadAllTraces(u.id)} disabled={loadingFull.has(u.id)} style={{
                        background: 'none', border: 'none', color: '#38ADA9', fontSize: 11, fontWeight: 700,
                        cursor: loadingFull.has(u.id) ? 'wait' : 'pointer', padding: 0,
                      }}>{loadingFull.has(u.id) ? '読み込み中…' : `全${u.traceCount}件を見る（非公開含む）`}</button>
                    )}
                  </div>
                  {(fullTraces[u.id] ?? u.recentTraces).map(t => {
                    const emotion = getEmotion(t.emotion_key);
                    const vis = VISIBILITY_LABELS[t.visibility];
                    // fullTraces（/api/admin/traces由来）にだけ入っている詳細フィールド
                    const full = 'region' in t ? (t as Trace) : null;
                    const category = full?.category ? getCategory(full.category) : null;
                    return (
                      <div key={t.id} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        padding: '8px 0', borderBottom: '1px solid #f5f5f5',
                      }}>
                        {t.photo_url ? (
                          <img src={t.photo_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 56, height: 56, borderRadius: 8, background: (emotion?.color ?? '#eee') + '22', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                          }}>{emotion?.emoji ?? '📍'}</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#333' }}>
                            {t.title}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#bbb' }}>
                            {new Date(t.created_at).toLocaleDateString('ja-JP')}
                            {vis && <span style={{ marginLeft: 6, color: vis.color, fontWeight: 700 }}>{vis.label}</span>}
                            {emotion && <span style={{ marginLeft: 6 }}>{emotion.emoji} {emotion.label}</span>}
                            {full?.region && <span style={{ marginLeft: 6 }}>🏘 {full.region}</span>}
                            {category && <span style={{ marginLeft: 6 }}>🏷 {category.label}</span>}
                          </p>
                          {t.why && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                              <strong style={{ color: '#999', fontWeight: 700 }}>なぜ気になった：</strong>{t.why}
                            </p>
                          )}
                          {full?.interpretation && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                              <strong style={{ color: '#999', fontWeight: 700 }}>見えた暮らし：</strong>{full.interpretation}
                            </p>
                          )}
                          {full?.self_reflection && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                              <strong style={{ color: '#999', fontWeight: 700 }}>自分とのつながり：</strong>{full.self_reflection}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

