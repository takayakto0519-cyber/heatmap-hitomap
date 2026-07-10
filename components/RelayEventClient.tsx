'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Route, Trace } from '@/lib/types';
import TraceDetail from '@/components/TraceDetail';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa' }}>地図を読み込み中…</div>,
});

interface Props {
  route: Route;
  traces: Trace[];
}

// チーム名→色。運営はチーム名を自由記述するため、登場順に固定パレットを割り当てる
const TEAM_PALETTE = ['#4A90E2', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD', '#16A085', '#D35400', '#2C3E50'];

function formatPeriod(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt && !endsAt) return null;
  const fmt = (s: string) => new Date(s).toLocaleString('ja-JP', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (startsAt && endsAt) return `${fmt(startsAt)} 〜 ${fmt(endsAt)}`;
  return fmt((startsAt ?? endsAt)!);
}

export default function RelayEventClient({ route, traces: initialTraces }: Props) {
  const [traces, setTraces] = useState(initialTraces);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => setCurrentUserId(d.user?.id ?? null)).catch(() => {});
  }, []);

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

  const teamNames = useMemo(() => {
    const seen = new Set<string>();
    for (const t of traces) if (t.team) seen.add(t.team);
    return Array.from(seen);
  }, [traces]);

  const teamColors = useMemo(() => {
    const map: Record<string, string> = {};
    teamNames.forEach((name, i) => { map[name] = TEAM_PALETTE[i % TEAM_PALETTE.length]; });
    return map;
  }, [teamNames]);

  const teamStats = useMemo(() => {
    const stats: Record<string, { posts: number; reactions: number }> = {};
    for (const t of traces) {
      if (!t.team) continue;
      const s = stats[t.team] ?? (stats[t.team] = { posts: 0, reactions: 0 });
      s.posts += 1;
      s.reactions += reactionCounts[t.id] ?? 0;
    }
    return Object.entries(stats).sort((a, b) => b[1].reactions - a[1].reactions);
  }, [traces, reactionCounts]);

  const ranking = useMemo(() => {
    return [...traces]
      .sort((a, b) => (reactionCounts[b.id] ?? 0) - (reactionCounts[a.id] ?? 0))
      .filter(t => (reactionCounts[t.id] ?? 0) > 0)
      .slice(0, 5);
  }, [traces, reactionCounts]);

  const feed = useMemo(() => [...traces].reverse(), [traces]);

  // イベントの広さに地図をあわせる：投稿ピン＋スタート/ゴール地点をすべて収める範囲を計算する
  const eventPins = useMemo(() => {
    const list: { lat: number; lng: number; emoji: string; color: string; label: string }[] = [];
    if (route.event_start_lat != null && route.event_start_lng != null) {
      list.push({ lat: route.event_start_lat, lng: route.event_start_lng, emoji: '🚩', color: '#27AE60', label: route.event_start_label ?? 'スタート地点' });
    }
    if (route.event_end_lat != null && route.event_end_lng != null) {
      list.push({ lat: route.event_end_lat, lng: route.event_end_lng, emoji: '🏁', color: '#E55039', label: route.event_end_label ?? 'ゴール地点' });
    }
    return list;
  }, [route]);

  const waypoints = route.event_waypoints ?? [];

  // スタート→経由地点→ゴールの順に線でつなぎ、どういう経路を歩くのかが見えるようにする
  const eventRouteLine = useMemo((): [number, number][] | undefined => {
    const points: [number, number][] = [
      ...(route.event_start_lat != null && route.event_start_lng != null ? [[route.event_start_lat, route.event_start_lng] as [number, number]] : []),
      ...waypoints.map((w): [number, number] => [w.lat, w.lng]),
      ...(route.event_end_lat != null && route.event_end_lng != null ? [[route.event_end_lat, route.event_end_lng] as [number, number]] : []),
    ];
    return points.length >= 2 ? points : undefined;
  }, [route, waypoints]);

  const eventFitBounds = useMemo((): [[number, number], [number, number]] | undefined => {
    const points: [number, number][] = [
      ...traces.map((t): [number, number] => [t.latitude, t.longitude]),
      ...eventPins.map((p): [number, number] => [p.lat, p.lng]),
      ...waypoints.map((w): [number, number] => [w.lat, w.lng]),
    ];
    if (points.length === 0) return undefined;
    const lats = points.map(p => p[0]);
    const lngs = points.map(p => p[1]);
    return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
  }, [traces, eventPins, waypoints]);

  function handleTraceUpdate(updated: Trace) {
    setTraces(prev => prev.map(t => (t.id === updated.id ? updated : t)));
    setSelectedTrace(updated);
  }

  function handleTraceDelete(id: string) {
    setTraces(prev => prev.filter(t => t.id !== id));
    setSelectedTrace(null);
  }

  const period = formatPeriod(route.event_starts_at, route.event_ends_at);

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa' }}>
      <div style={{
        position: 'relative', minHeight: 220,
        backgroundColor: '#38ADA9',
        backgroundImage: route.event_cover_url ? `url(${route.event_cover_url})` : 'linear-gradient(135deg, #38ADA9, #4A90E2)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'flex', alignItems: 'flex-end',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0) 100%)',
        }} />
        <div style={{ position: 'relative', padding: '24px 20px', color: '#fff', width: '100%', boxSizing: 'border-box' }}>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 20,
            background: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, marginBottom: 8,
          }}>🏃 リレー型イベント{route.event_area ? ` ・ 📍${route.event_area}` : ''}</span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.3 }}>{route.title}</h1>
          {period && <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9 }}>🗓 {period}</p>}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 20px 60px' }}>
        <a href="/map" style={{ fontSize: 13, color: '#38ADA9', textDecoration: 'none', fontWeight: 700 }}>← ヒトマップの地図を見る</a>

        {route.description && (
          <p style={{ margin: '16px 0', fontSize: 15, lineHeight: 1.8, color: '#333', whiteSpace: 'pre-wrap' }}>{route.description}</p>
        )}

        {(route.event_photo_urls ?? []).length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 0 16px' }}>
            {(route.event_photo_urls ?? []).slice(1).map((url, i) => (
              <img key={i} src={url} alt="" loading="lazy" style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
            ))}
          </div>
        )}

        {(route.event_fee || route.event_meeting_info) && (
          <div style={{ margin: '0 0 16px', background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '12px 14px' }}>
            {route.event_fee && (
              <p style={{ margin: '0 0 6px', fontSize: 13, color: '#333' }}>
                <strong style={{ color: '#38ADA9' }}>参加費：</strong>{route.event_fee}
              </p>
            )}
            {route.event_meeting_info && (
              <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{route.event_meeting_info}</p>
            )}
          </div>
        )}

        {route.event_session_code && (
          <p style={{
            margin: '0 0 16px', fontSize: 13, color: '#38ADA9', background: '#EAF7F6',
            padding: '10px 14px', borderRadius: 10,
          }}>
            参加するには、投稿画面の「実験回コード」に <strong>{route.event_session_code}</strong> を、「チーム名」に自分のチーム名を入力して投稿してください。
          </p>
        )}

        {/* チーム別スコアボード */}
        {teamStats.length > 0 && (
          <div style={{ margin: '0 0 20px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#444', margin: '0 0 8px' }}>🏆 チーム別スコア</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {teamStats.map(([team, s], i) => (
                <div key={team} style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: '#fff',
                  border: `1.5px solid ${teamColors[team]}`, borderRadius: 10, padding: '10px 12px',
                }}>
                  <span style={{ fontSize: 16 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏳'}</span>
                  <span style={{
                    width: 10, height: 10, borderRadius: 5, background: teamColors[team], flexShrink: 0,
                  }} />
                  <strong style={{ fontSize: 14, flex: 1 }}>{team}</strong>
                  <span style={{ fontSize: 12, color: '#888' }}>投稿 {s.posts}</span>
                  <span style={{ fontSize: 12, color: '#FF6B9D', fontWeight: 700 }}>🔥 {s.reactions}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 共有マップ：チームごとに色分け */}
        <div style={{ height: 300, borderRadius: 14, overflow: 'hidden', margin: '16px 0', border: '1px solid #eee' }}>
          <TraceMap
            traces={traces}
            reactionCounts={reactionCounts}
            currentUserId={currentUserId}
            teamColors={teamColors}
            onTraceClick={setSelectedTrace}
            pins={eventPins}
            waypoints={waypoints}
            routeLine={eventRouteLine}
            fitBounds={eventFitBounds}
            allowWideZoom
          />
        </div>

        <p style={{ fontSize: 12, color: '#999', margin: '0 0 20px' }}>{traces.length}件の発見</p>

        {/* 投票ランキング */}
        {ranking.length > 0 && (
          <div style={{ margin: '0 0 24px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#444', margin: '0 0 8px' }}>✨ 今日一番、人に紹介したい場所</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ranking.map((t, i) => (
                <button key={t.id} onClick={() => setSelectedTrace(t)} style={{
                  display: 'flex', gap: 10, alignItems: 'center', background: '#fff', textAlign: 'left',
                  borderRadius: 10, padding: '10px 12px', border: '1px solid #f0f0f0', cursor: 'pointer', width: '100%',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#FF6B9D', width: 20 }}>{i + 1}</span>
                  {t.photo_url && (
                    <img src={t.photo_url} alt={t.title} loading="lazy"
                      style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                    {t.team && (
                      <span style={{ fontSize: 11, color: teamColors[t.team] ?? '#888', fontWeight: 700 }}>🏳 {t.team}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: '#FF6B9D', fontWeight: 700, flexShrink: 0 }}>🔥 {reactionCounts[t.id] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 時系列フィード */}
        <h2 style={{ fontSize: 14, fontWeight: 800, color: '#444', margin: '0 0 8px' }}>📝 発見の記録</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {feed.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>まだ投稿がありません。</p>}
          {feed.map((t) => (
            <button key={t.id} onClick={() => setSelectedTrace(t)} style={{
              display: 'flex', gap: 10, alignItems: 'center', background: '#fff', textAlign: 'left',
              borderRadius: 10, padding: '10px 12px', border: '1px solid #f0f0f0', cursor: 'pointer', width: '100%',
            }}>
              {t.photo_url && (
                <img src={t.photo_url} alt={t.title} loading="lazy"
                  style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>
                  {t.team && <span style={{ color: teamColors[t.team] ?? '#888', fontWeight: 700 }}>🏳 {t.team} ・ </span>}
                  {t.nickname ? `${t.nickname} ・ ` : ''}
                  {new Date(t.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {(reactionCounts[t.id] ?? 0) > 0 && (
                <span style={{ fontSize: 12, color: '#FF6B9D', fontWeight: 700, flexShrink: 0 }}>🔥 {reactionCounts[t.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedTrace && (
        <TraceDetail
          key={selectedTrace.id}
          trace={selectedTrace}
          isOwn={selectedTrace.user_id ? selectedTrace.user_id === currentUserId : false}
          onClose={() => setSelectedTrace(null)}
          onUpdate={handleTraceUpdate}
          onDelete={handleTraceDelete}
        />
      )}
    </div>
  );
}
