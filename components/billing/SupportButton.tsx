'use client';

import { useState } from 'react';
import { corpColor, corpFont } from '@/components/corp/tokens';

interface Props {
  mode?: 'checkout' | 'portal';
}

const CONFIG = {
  checkout: { endpoint: '/api/billing/checkout', label: 'サポーターになる', loadingLabel: '手続き中…' },
  portal: { endpoint: '/api/billing/portal', label: '支払い方法・解約を管理する', loadingLabel: '読み込み中…' },
} as const;

export default function SupportButton({ mode = 'checkout' }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { endpoint, label, loadingLabel } = CONFIG[mode];

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
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

  const isPrimary = mode === 'checkout';

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'inline-block',
          padding: isPrimary ? '15px 32px' : '11px 22px',
          background: isPrimary ? corpColor.ink : 'transparent',
          color: isPrimary ? corpColor.white : corpColor.ink,
          border: isPrimary ? 'none' : `1px solid ${corpColor.line}`,
          fontWeight: 700,
          fontSize: isPrimary ? 14 : 13,
          fontFamily: corpFont.body,
          letterSpacing: '0.05em',
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? loadingLabel : label}
      </button>
      {error && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: corpColor.inkSoft }}>{error}</p>
      )}
    </div>
  );
}
