'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Trace, ListTracesResponse, Sponsor, ListSponsorsResponse } from '@/lib/types';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';
import RegionTimeline from '@/components/region/RegionTimeline';
import Storytellers from '@/components/region/Storytellers';
import AfterStories from '@/components/region/AfterStories';

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
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`/api/traces?region=${encodeURIComponent(regionName)}`)
      .then(r => r.json() as Promise<ListTracesResponse>)
      .then(d => { if (d.ok) setTraces(d.traces); else setError(d.error ?? '取得に失敗しました'); })
      .catch(e => setError(e instanceof Error ? e.message : '通信エラー'))
      .finally(() => setLoading(false));
    fetch(`/api/sponsors?placement=region&region=${encodeURIComponent(regionName)}`)
      .then(r => r.json() as Promise<ListSponsorsResponse>)
      .then(d => { if (d.ok && d.sponsors.length > 0) setSponsor(d.sponsors[0]); })
      .catch(() => {});
    fetch('/api/profile').then(r => r.json()).then(d => setCurrentUserId(d.user?.id ?? null)).catch(() => {});
  }, [regionName]);

  // 共感ヒート：表示中の痕跡の反応数をまとめて取得し、ピンの色濃度・サイズに反映する
  useEffect(() => {
    if (traces.length === 0) return;
    const ids = traces.map(t => t.id).join(',');
    fetch(`/api/reactions?trace_ids=${ids}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const totals: Record<string, number> = {};
        for (const [traceId, byType] of Object.entries(d.counts ?? {}) as [string, Record<string, number>][]) {
          totals[traceId] = Object.values(byType).reduce((sum, n) => sum + n, 0);
        }
        setReactionCounts(totals);
      })
      .catch(() => {});
  }, [traces]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#f8f8f8' }}>
      <header style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        <a href="/map" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>← ヒトマップ全体へ</a>
        <h1 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>🏘 {regionName}</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>{loading ? '読み込み中…' : `${traces.length}件の記録`}</p>
          <a href={`/region/${encodeURIComponent(regionName)}/print`} style={{ fontSize: 11, color: '#8E44AD', textDecoration: 'none', fontWeight: 700 }}>
            🖨 掲示用ギャラリー
          </a>
        </div>
      </header>

      {sponsor && (
        <a href={sponsor.url ?? undefined} target={sponsor.url ? '_blank' : undefined} rel="noopener noreferrer" style={{
          display: 'block', padding: '8px 16px', background: '#FFF8E8', borderBottom: '1px solid #F0E4C0',
          textDecoration: 'none', flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#B7791F', fontWeight: 700, marginRight: 6 }}>PR</span>
          <span style={{ fontSize: 12, color: '#8A6D3B' }}>{sponsor.name}{sponsor.message ? ` ・ ${sponsor.message}` : ''}</span>
        </a>
      )}

      <div style={{ height: '55%', flexShrink: 0 }}>
        {traces.length > 0 && (
          <TraceMap
            traces={traces}
            mode="pin"
            currentUserId={currentUserId}
            reactionCounts={reactionCounts}
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
        {!loading && traces.length > 0 && (
          <>
            <RegionTimeline traces={traces} onTraceClick={setSelectedTrace} />
            <AfterStories traces={traces} onTraceClick={setSelectedTrace} />
            <Storytellers traces={traces} />
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {traces.map(t => (
            <TraceCard key={t.id} trace={t} onClick={() => setSelectedTrace(t)} />
          ))}
        </div>
      </div>

      {selectedTrace && (
        <TraceDetail
          key={selectedTrace.id}
          trace={selectedTrace}
          isOwn={Boolean(currentUserId) && selectedTrace.user_id === currentUserId}
          onClose={() => setSelectedTrace(null)}
          onUpdate={updated => setTraces(prev => prev.map(t => (t.id === updated.id ? updated : t)))}
          onDelete={id => setTraces(prev => prev.filter(t => t.id !== id))}
        />
      )}
    </div>
  );
}
