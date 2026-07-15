'use client';

import { useEffect, useState } from 'react';
import type { Route, ListRoutesResponse } from '@/lib/types';
import BottomNav from '@/components/BottomNav';

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
    <div style={{ minHeight: '100dvh', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid #eee' }}>
        <a href="/map" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>← ヒトマップ全体へ</a>
        <h1 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: '#8E44AD' }}>🎉 イベント</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>ヒトマップが開催・運営しているイベント一覧</p>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 60px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
        {loading && <p style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>読み込み中…</p>}
        {error && <p style={{ color: '#E74C3C', textAlign: 'center', marginTop: 40 }}>{error}</p>}
        {!loading && !error && routes.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60, color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <p style={{ fontSize: 14, margin: 0 }}>まだ公開中のイベントはありません</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {routes.map(r => (
            // bonno型は地図・地点を持たないので、イベントページ（/events/[slug]）へ直接飛ばす
            <a key={r.id} href={r.event_mode === 'bonno' && r.event_slug ? `/events/${r.event_slug}` : `/routes/${r.id}`} style={{
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
              {r.event_mode !== 'bonno' && (
                <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
                  {r.trace_ids.length}地点
                  {r.sponsor_name && ` ・ 協賛：${r.sponsor_name}`}
                </p>
              )}
            </a>
          ))}
        </div>
      </div>
      <BottomNav active="routes" />
    </div>
  );
}
