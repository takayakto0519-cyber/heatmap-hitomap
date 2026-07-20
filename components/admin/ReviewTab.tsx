'use client';

// 承認待ち：全国公開の申請を承認/却下する。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import type { Trace } from '@/lib/types';
import { Card, AuthorLine, ContentTags, useAuthorMap } from '@/components/admin/adminShared';

export default function ReviewTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
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

