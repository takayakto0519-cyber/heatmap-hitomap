'use client';

// SAGOJO の「旅した地域」カードを参考にした、記録した地域の一覧カード。
// traces[].region（「大阪府浪速区」形式）から都道府県数・町数を数える。新規テーブルなし。
import { useState } from 'react';
import { extractPrefecture } from '@/lib/character';
import type { Trace } from '@/lib/types';

export default function RegionCounterCard({ traces }: { traces: Trace[] }) {
  const [expanded, setExpanded] = useState(false);

  const regions = Array.from(new Set(traces.map((t) => t.region).filter((r): r is string => Boolean(r)))).sort();
  const prefectures = Array.from(
    new Set(regions.map(extractPrefecture).filter((p): p is string => Boolean(p)))
  );

  if (regions.length === 0) return null;

  return (
    <div style={{
      marginTop: 20, borderRadius: 14, overflow: 'hidden', position: 'relative',
      background: 'linear-gradient(135deg, #2F8C88, #566246)', color: '#fff', padding: 18,
    }}>
      <svg viewBox="0 0 400 120" width="100%" height="90" preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, opacity: 0.25 }}>
        <path d="M0,80 Q80,40 160,70 T320,55 T400,70 V120 H0 Z" fill="#fff" />
        <path d="M0,100 Q120,70 220,95 T400,90 V120 H0 Z" fill="#fff" opacity="0.6" />
      </svg>

      <div style={{ position: 'relative' }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800 }}>🗾 旅した地域</p>
        <div style={{ display: 'flex', gap: 28 }}>
          <div>
            <span style={{ fontSize: 30, fontWeight: 900 }}>{prefectures.length}</span>
            <span style={{ fontSize: 12, marginLeft: 4 }}>都道府県</span>
          </div>
          <div>
            <span style={{ fontSize: 30, fontWeight: 900 }}>{regions.length}</span>
            <span style={{ fontSize: 12, marginLeft: 4 }}>の町</span>
          </div>
        </div>

        <button onClick={() => setExpanded((v) => !v)} style={{
          marginTop: 12, width: '100%', padding: '9px 0', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.6)',
          background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
        }}>
          {expanded ? '▴ 閉じる' : '▾ 記録した地域一覧'}
        </button>

        {expanded && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {regions.map((r) => (
              <span key={r} style={{
                fontSize: 11.5, background: 'rgba(255,255,255,0.18)', padding: '4px 10px', borderRadius: 999,
              }}>{r}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
