'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Route, Trace, RouteDetailResponse } from '@/lib/types';
import { haversine } from '@/lib/geo';

const RouteMap = dynamic(() => import('@/components/map/RouteMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa' }}>地図を読み込み中…</div>,
});

function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const y = Math.sin((lng2 - lng1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
    - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lng2 - lng1) * Math.PI / 180);
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  return dirs[Math.round(deg / 45) % 8];
}

const ARRIVAL_RADIUS = 40; // メートル。この距離に入ったら「到着」扱い

export default function RoutePage() {
  const { id } = useParams<{ id: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [walking, setWalking] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [gpsError, setGpsError] = useState('');
  const [completionCount, setCompletionCount] = useState<number | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    fetch(`/api/routes/${id}`)
      .then(r => r.json() as Promise<RouteDetailResponse>)
      .then(d => {
        if (d.ok) { setRoute(d.route ?? null); setTraces(d.traces ?? []); }
        else setError(d.error ?? '取得に失敗しました');
      })
      .catch(e => setError(e instanceof Error ? e.message : '通信エラー'))
      .finally(() => setLoading(false));
    fetch(`/api/routes/${id}/complete`)
      .then(r => r.json())
      .then(d => { if (d.ok) setCompletionCount(d.count); })
      .catch(() => {});
  }, [id]);

  const nextTrace = traces.find(t => !visitedIds.includes(t.id));

  const checkArrival = useCallback((pos: [number, number]) => {
    if (!nextTrace) return;
    const dist = haversine(pos[0], pos[1], nextTrace.latitude, nextTrace.longitude);
    if (dist <= ARRIVAL_RADIUS) {
      setVisitedIds(prev => prev.includes(nextTrace.id) ? prev : [...prev, nextTrace.id]);
    }
  }, [nextTrace]);

  // 全地点を歩き終えたら一度だけ踏破を記録する（🏅 無料版スタンプラリー）
  useEffect(() => {
    if (walking && traces.length > 0 && !nextTrace && !justCompleted) {
      setJustCompleted(true);
      fetch(`/api/routes/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: route?.nickname ?? undefined }),
      }).then(() => setCompletionCount(c => (c ?? 0) + 1)).catch(() => {});
    }
  }, [walking, traces.length, nextTrace, justCompleted, id, route]);

  useEffect(() => {
    if (!walking || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      p => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
        setUserPos(pos);
        checkArrival(pos);
      },
      () => setGpsError('位置情報を取得できませんでした'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [walking, checkArrival]);

  if (loading) return <div style={{ padding: 20 }}>読み込み中…</div>;
  if (error || !route) return <div style={{ padding: 20, color: '#E74C3C' }}>{error ?? 'ルートが見つかりません'}</div>;

  const distToNext = userPos && nextTrace ? haversine(userPos[0], userPos[1], nextTrace.latitude, nextTrace.longitude) : null;
  const dirToNext = userPos && nextTrace ? bearing(userPos[0], userPos[1], nextTrace.latitude, nextTrace.longitude) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#f8f8f8' }}>
      <header style={{ padding: '12px 16px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        <a href="/map" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>← ヒトマップ全体へ</a>
        <h1 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>🥾 {route.title}</h1>
        {route.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>{route.description}</p>}
        {route.is_public_recommendation && route.review_status === 'approved' && (
          <span style={{
            display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 20,
            background: '#FBF6FF', color: '#8E44AD', fontSize: 11, fontWeight: 700,
          }}>✨ おすすめルート</span>
        )}
        {route.highlights && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#8E44AD', background: '#FBF6FF', padding: '8px 10px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
            👀 {route.highlights}
          </p>
        )}
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#aaa' }}>
          {traces.length}地点 {route.nickname ? `・ ${route.nickname}` : ''}
          {completionCount !== null && completionCount > 0 ? ` ・ 🏅${completionCount}人が踏破` : ''}
        </p>
        {route.sponsor_name && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#B7791F', background: '#FFF8E8', display: 'inline-block', padding: '3px 9px', borderRadius: 8 }}>
            PR ・ 協賛：{route.sponsor_url ? <a href={route.sponsor_url} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F' }}>{route.sponsor_name}</a> : route.sponsor_name}
          </p>
        )}
      </header>

      <div style={{ height: '45%', flexShrink: 0 }}>
        <RouteMap
          traces={traces}
          visitedIds={visitedIds}
          startPoint={route.event_start_lat != null && route.event_start_lng != null
            ? { lat: route.event_start_lat, lng: route.event_start_lng, label: route.event_start_label ?? 'スタート地点' } : null}
          endPoint={route.event_end_lat != null && route.event_end_lng != null
            ? { lat: route.event_end_lat, lng: route.event_end_lng, label: route.event_end_label ?? 'ゴール地点' } : null}
          waypoints={route.event_waypoints ?? []}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {!walking ? (
          <button onClick={() => setWalking(true)} style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #8E44AD, #C29FE0)', color: '#fff',
            fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 16,
          }}>🚶 この足跡を辿りはじめる</button>
        ) : (
          <div style={{
            background: '#fff', borderRadius: 14, padding: 16, marginBottom: 16,
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
          }}>
            {gpsError && <p style={{ color: '#E55039', fontSize: 12 }}>{gpsError}</p>}
            {nextTrace ? (
              <>
                <p style={{ fontSize: 11, color: '#999', margin: '0 0 4px', fontWeight: 700 }}>次の目的地</p>
                <p style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px' }}>{nextTrace.title}</p>
                {distToNext !== null ? (
                  <p style={{ fontSize: 14, color: '#8E44AD', margin: 0, fontWeight: 700 }}>
                    {dirToNext}の方向 ・ 約{distToNext < 1000 ? `${Math.round(distToNext)}m` : `${(distToNext / 1000).toFixed(1)}km`}
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>位置情報を取得中…</p>
                )}
                <p style={{ fontSize: 11, color: '#ccc', margin: '8px 0 0' }}>近づくと自動的に到着扱いになります（半径{ARRIVAL_RADIUS}m）</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#8E44AD', margin: 0 }}>🎉 すべての地点を歩き終えました</p>
                <p style={{ fontSize: 26, margin: '10px 0 0' }}>🏅</p>
                <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>踏破バッジを獲得しました{completionCount !== null ? `（あなたで${completionCount}人目）` : ''}</p>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {traces.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', gap: 10, alignItems: 'center', background: '#fff',
              borderRadius: 10, padding: '10px 12px',
              opacity: visitedIds.includes(t.id) ? 0.5 : 1,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                background: visitedIds.includes(t.id) ? '#bbb' : '#8E44AD', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
              }}>{visitedIds.includes(t.id) ? '✓' : i + 1}</div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{t.title}</p>
                {t.why && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>{t.why}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
