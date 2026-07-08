'use client';

import { useEffect, useState } from 'react';
import type { Route, ListRoutesResponse } from '@/lib/types';

export default function RoutesListPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json() as Promise<ListRoutesResponse>)
      .then(d => {
        if (d.ok) {
          setRoutes(d.routes.filter(r => r.is_public_recommendation && r.review_status === 'approved' && r.event_mode !== 'relay'));
        } else {
          setError(d.error ?? '取得に失敗しました');
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : '通信エラー'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa' }}>
      <header style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid #eee' }}>
        <a href="/map" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>← ヒトマップ全体へ</a>
        <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#8E44AD' }}>🥾 おすすめルート</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>みんなが歩いて見つけた、運営おすすめの散歩道</p>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 60px' }}>
        {loading && <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>読み込み中…</p>}
        {error && <p style={{ color: '#E74C3C', textAlign: 'center', marginTop: 40 }}>{error}</p>}
        {!loading && !error && routes.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60, color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🥾</div>
            <p style={{ fontSize: 14, margin: 0 }}>まだおすすめルートはありません</p>
            <p style={{ fontSize: 12, marginTop: 6 }}>ログインしてルートを作成し、公開申請してみましょう</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {routes.map(r => (
            <a key={r.id} href={`/routes/${r.id}`} style={{
              display: 'block', background: '#fff', borderRadius: 14, padding: 16,
              border: '1px solid #f0f0f0', textDecoration: 'none', color: 'inherit',
              boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
            }}>
              <span style={{
                display: 'inline-block', padding: '2px 9px', borderRadius: 20,
                background: '#FBF6FF', color: '#8E44AD', fontSize: 11, fontWeight: 700, marginBottom: 6,
              }}>✨ おすすめ</span>
              <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#333' }}>{r.title}</p>
              {r.description && (
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666', lineHeight: 1.6 }}>{r.description}</p>
              )}
              {r.highlights && (
                <p style={{
                  margin: '0 0 8px', fontSize: 12, color: '#8E44AD', background: '#FBF6FF',
                  padding: '8px 10px', borderRadius: 8, whiteSpace: 'pre-wrap',
                }}>👀 {r.highlights}</p>
              )}
              <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
                {r.trace_ids.length}地点
                {r.sponsor_name && ` ・ 協賛：${r.sponsor_name}`}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
