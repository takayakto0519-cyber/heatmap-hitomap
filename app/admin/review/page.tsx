'use client';

import { useState } from 'react';
import type { Trace } from '@/lib/types';

export default function AdminReviewPage() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(pw: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/traces?status=pending_review', {
        headers: { 'x-admin-password': pw },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? '取得に失敗しました');
      setTraces(data.traces);
      setUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー');
    } finally {
      setLoading(false);
    }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    const res = await fetch(`/api/admin/traces/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (data.ok) {
      setTraces(prev => prev.filter(t => t.id !== id));
    } else {
      setError(data.error ?? '処理に失敗しました');
    }
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <form
          onSubmit={e => { e.preventDefault(); load(password); }}
          style={{ background: '#fff', padding: 24, borderRadius: 16, width: 320, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>審査画面（合言葉）</h1>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="合言葉" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box' }}
          />
          {error && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 10, borderRadius: 8, border: 'none',
            background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}>{loading ? '確認中…' : '入る'}</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>全国公開 審査待ち一覧</h1>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>{traces.length}件</p>
      {traces.length === 0 && <p style={{ color: '#aaa' }}>審査待ちの投稿はありません。</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {traces.map(t => (
          <div key={t.id} style={{ background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>{t.title}</p>
            {t.why && <p style={{ fontSize: 13, color: '#555', margin: '0 0 8px' }}>{t.why}</p>}
            <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 8px' }}>
              {t.nickname ?? '匿名'} ・ {new Date(t.created_at).toLocaleString('ja-JP')} ・ {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => review(t.id, 'approve')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                background: '#27AE60', color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>承認（全国公開）</button>
              <button onClick={() => review(t.id, 'reject')} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', fontWeight: 700, cursor: 'pointer',
              }}>却下（非公開に戻す）</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
