'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Route, Trace } from '@/lib/types';

const RouteMap = dynamic(() => import('@/components/map/RouteMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa' }}>地図を読み込み中…</div>,
});

interface Props {
  route: Route;
  traces: Trace[];
}

function formatPeriod(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt && !endsAt) return null;
  const fmt = (s: string) => new Date(s).toLocaleString('ja-JP', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (startsAt && endsAt) return `${fmt(startsAt)} 〜 ${fmt(endsAt)}`;
  return fmt((startsAt ?? endsAt)!);
}

export default function EventPageClient({ route, traces }: Props) {
  const [completionCount, setCompletionCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/routes/${route.id}/complete`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCompletionCount(d.count); })
      .catch(() => {});
  }, [route.id]);

  async function handleShare() {
    const shareUrl = `${window.location.origin}/events/${route.event_slug}`;
    if (navigator.share) {
      await navigator.share({ title: route.title, text: route.title, url: shareUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${route.title}\n${shareUrl}`);
      alert('クリップボードにコピーしました');
    }
  }

  const period = formatPeriod(route.event_starts_at, route.event_ends_at);

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa' }}>
      {/* ヒーロー */}
      <div style={{
        position: 'relative', minHeight: 220,
        backgroundColor: '#8E44AD',
        backgroundImage: route.event_cover_url ? `url(${route.event_cover_url})` : 'linear-gradient(135deg, #8E44AD, #C29FE0)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'flex', alignItems: 'flex-end',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0) 100%)',
        }} />
        <div style={{ position: 'relative', padding: '24px 20px', color: '#fff', width: '100%', boxSizing: 'border-box' }}>
          {route.event_area && (
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
              background: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700, marginBottom: 8,
            }}>📍 {route.event_area}</span>
          )}
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.3 }}>{route.title}</h1>
          {period && <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9 }}>🗓 {period}</p>}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 20px 60px' }}>
        <a href="/map" style={{ fontSize: 13, color: '#38ADA9', textDecoration: 'none', fontWeight: 700 }}>← ヒトマップの地図を見る</a>

        {route.description && (
          <p style={{ margin: '16px 0', fontSize: 15, lineHeight: 1.8, color: '#333' }}>{route.description}</p>
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
                <strong style={{ color: '#8E44AD' }}>参加費：</strong>{route.event_fee}
              </p>
            )}
            {route.event_meeting_info && (
              <p style={{ margin: 0, fontSize: 13, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{route.event_meeting_info}</p>
            )}
          </div>
        )}

        <div style={{ height: 260, borderRadius: 14, overflow: 'hidden', margin: '16px 0', border: '1px solid #eee' }}>
          <RouteMap
            traces={traces}
            startPoint={route.event_start_lat != null && route.event_start_lng != null
              ? { lat: route.event_start_lat, lng: route.event_start_lng, label: route.event_start_label ?? 'スタート地点' } : null}
            endPoint={route.event_end_lat != null && route.event_end_lng != null
              ? { lat: route.event_end_lat, lng: route.event_end_lng, label: route.event_end_label ?? 'ゴール地点' } : null}
            waypoints={route.event_waypoints ?? []}
          />
        </div>

        <p style={{ fontSize: 12, color: '#999', margin: '0 0 16px' }}>
          {traces.length}地点
          {completionCount !== null && completionCount > 0 ? ` ・ 🏅${completionCount}人が踏破` : ''}
        </p>

        {route.sponsor_name && (
          <p style={{
            margin: '0 0 16px', fontSize: 12, color: '#B7791F', background: '#FFF8E8',
            display: 'inline-block', padding: '5px 12px', borderRadius: 10,
          }}>
            PR ・ 協賛：{route.sponsor_url ? (
              <a href={route.sponsor_url} target="_blank" rel="noopener noreferrer" style={{ color: '#B7791F' }}>{route.sponsor_name}</a>
            ) : route.sponsor_name}
          </p>
        )}

        <a href={`/routes/${route.id}`} style={{
          display: 'block', textAlign: 'center', padding: '15px',
          borderRadius: 12, border: 'none', color: '#fff', fontSize: 16, fontWeight: 800,
          textDecoration: 'none', background: 'linear-gradient(135deg, #8E44AD, #C29FE0)', marginBottom: 10,
        }}>🚶 歩きはじめる →</a>

        <button onClick={handleShare} style={{
          display: 'block', width: '100%', padding: '13px', borderRadius: 12,
          border: '1.5px solid #ddd', background: '#fff', color: '#444',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>📤 このイベントをシェア</button>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {traces.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', gap: 10, alignItems: 'center', background: '#fff',
              borderRadius: 10, padding: '10px 12px', border: '1px solid #f0f0f0',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                background: '#8E44AD', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
              }}>{i + 1}</div>
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
