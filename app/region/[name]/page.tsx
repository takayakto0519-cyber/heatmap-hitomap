'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Trace, ListTracesResponse } from '@/lib/types';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa' }}>地図を読み込み中…</div>,
});

export default function RegionPage() {
  const { name } = useParams<{ name: string }>();
  const regionName = decodeURIComponent(name);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  useEffect(() => {
    fetch(`/api/traces?region=${encodeURIComponent(regionName)}`)
      .then(r => r.json() as Promise<ListTracesResponse>)
      .then(d => { if (d.ok) setTraces(d.traces); else setError(d.error ?? '取得に失敗しました'); })
      .catch(e => setError(e instanceof Error ? e.message : '通信エラー'))
      .finally(() => setLoading(false));
  }, [regionName]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#f8f8f8' }}>
      <header style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        <a href="/" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>← ヒトマップ全体へ</a>
        <h1 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>🏘 {regionName}</h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#aaa' }}>{loading ? '読み込み中…' : `${traces.length}件の記録`}</p>
      </header>

      <div style={{ height: '55%', flexShrink: 0 }}>
        {traces.length > 0 && (
          <TraceMap
            traces={traces}
            mode="pin"
            center={[traces[0].latitude, traces[0].longitude]}
            onTraceClick={setSelectedTrace}
          />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {error && <p style={{ color: '#E55039', fontSize: 13 }}>{error}</p>}
        {!loading && traces.length === 0 && !error && (
          <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
            この地域にはまだ記録がありません。
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {traces.map(t => (
            <TraceCard key={t.id} trace={t} onClick={() => setSelectedTrace(t)} />
          ))}
        </div>
      </div>

      {selectedTrace && (
        <TraceDetail
          trace={selectedTrace}
          isOwn={false}
          onClose={() => setSelectedTrace(null)}
          onUpdate={() => {}}
          onDelete={() => setSelectedTrace(null)}
        />
      )}
    </div>
  );
}
