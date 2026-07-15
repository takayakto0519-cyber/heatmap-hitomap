'use client';

import { useState } from 'react';
import { corpColor, corpFont } from '@/components/corp/tokens';

export default function SupportButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? '手続きを開始できませんでした');
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'inline-block',
          padding: '15px 32px',
          background: corpColor.ink,
          color: corpColor.white,
          border: 'none',
          fontWeight: 700,
          fontSize: 14,
          fontFamily: corpFont.body,
          letterSpacing: '0.05em',
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '手続き中…' : 'サポーターになる'}
      </button>
      {error && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: corpColor.inkSoft }}>{error}</p>
      )}
    </div>
  );
}
