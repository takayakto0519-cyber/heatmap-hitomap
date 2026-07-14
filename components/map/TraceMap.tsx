'use client';

import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useState, useEffect } from 'react';
import type { Trace } from '@/lib/types';

function FlyToHandler({ pos, zoom = 17, bounds }: {
  pos: [number, number] | undefined;
  zoom?: number;
  bounds?: [[number, number], [number, number]];
}) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] });
  }, [bounds, map]);
  useEffect(() => {
    if (pos) map.flyTo(pos, zoom, { duration: 1.2 });
  }, [pos, zoom, map]);
  return null;
}
import { getEmotionColor, getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';
import { getArchiveType, getVoiceRelation } from '@/lib/archiveTypes';

// ログイン時、自分の投稿と他人の投稿を枠線の色で見分けられるようにする
const SELF_PIN_COLOR = '#4A90E2';

// 痕跡は町の縮尺でこそ証になる。ズームアウトしても一度に見える範囲は町・地区どまりにする（zoom 12 ≒ 一つの町・地区）
const MIN_TOWN_SCALE_ZOOM = 12;

// スタート・ゴール地点など、感情色に依らない旗ピンを立てるための共通関数
function createFlagPin(emoji: string, color: string) {
  const html = `<div style="
    width:30px;height:30px;
    background:${color};
    border:3px solid #fff;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 1px 5px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
  "><span style="transform:rotate(45deg);font-size:14px;">${emoji}</span></div>`;
  return L.divIcon({ html, iconSize: [30, 30], iconAnchor: [15, 29], popupAnchor: [0, -28], className: '' });
}

// スタート・ゴールの間の経由地点。番号つきの小さな丸ピンで、経路上の順番が分かるようにする
function createWaypointPin(n: number) {
  const html = `<div style="
    width:24px;height:24px;background:#8E44AD;border:2.5px solid #fff;border-radius:50%;
    box-shadow:0 1px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;
    color:#fff;font-weight:800;font-size:11px;
  ">${n}</div>`;
  return L.divIcon({ html, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14], className: '' });
}

// 共感ヒート：反応が重なるほどピンの色が濃く・大きくなる
// overrideColor が指定されている場合（relayイベントのチーム色分けなど）は感情色より優先する
// 誰の痕跡かひと目で分かるよう、ピンの右下に投稿者アイコンを小さく重ねる
function avatarBadgeHtml(avatarUrl: string | undefined, badgeSize: number): string {
  if (!avatarUrl) return '';
  const safeUrl = avatarUrl.replace(/'/g, '%27');
  return `<div style="
    position:absolute;right:-2px;bottom:-2px;
    width:${badgeSize}px;height:${badgeSize}px;border-radius:50%;
    border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);
    background-image:url('${safeUrl}');background-size:cover;background-position:center;background-color:#eee;
  "></div>`;
}

function createEmotionPin(emotionKey: string | null, reactionCount = 0, isMine = false, overrideColor?: string, avatarUrl?: string) {
  const color = overrideColor ?? getEmotionColor(emotionKey);
  const size = 22 + Math.min(reactionCount, 8) * 2.5;
  const half = size / 2;
  const opacity = Math.min(0.55 + reactionCount * 0.08, 1);
  const borderColor = isMine ? SELF_PIN_COLOR : '#fff';
  const borderWidth = isMine ? 4 : 3;
  const html = `<div style="position:relative;width:${size}px;height:${size}px;">
    <div style="
      width:100%;height:100%;
      background:${color};
      opacity:${opacity};
      border:${borderWidth}px solid ${borderColor};
      border-radius:50%;
      box-shadow:0 1px 5px rgba(0,0,0,0.4);
    "></div>
    ${avatarBadgeHtml(avatarUrl, Math.max(12, size * 0.42))}
  </div>`;
  return L.divIcon({ html, iconSize: [size, size], iconAnchor: [half, half], popupAnchor: [0, -half - 3], className: '' });
}

// 拡大するとピンが写真サムネイルになる（ヒートが集まった場所がどんな場所か一目で分かるように）
const PHOTO_THUMB_ZOOM = 16;

function createPhotoPin(photoUrl: string, borderColor: string, isMine = false, avatarUrl?: string) {
  const safeUrl = photoUrl.replace(/'/g, '%27');
  const size = 44;
  const half = size / 2;
  const ring = isMine ? `box-shadow:0 0 0 3px ${SELF_PIN_COLOR}, 0 2px 6px rgba(0,0,0,0.35);` : 'box-shadow:0 2px 6px rgba(0,0,0,0.35);';
  const html = `<div style="position:relative;width:${size}px;height:${size}px;">
    <div style="
      width:100%;height:100%;
      border-radius:50%;
      border:3px solid ${borderColor};
      ${ring}
      background-image:url('${safeUrl}');
      background-size:cover;background-position:center;
      background-color:#eee;
    "></div>
    ${avatarBadgeHtml(avatarUrl, 16)}
  </div>`;
  return L.divIcon({ html, iconSize: [size, size], iconAnchor: [half, half], popupAnchor: [0, -half - 4], className: '' });
}

function createArchivePin(archiveType: NonNullable<ReturnType<typeof getArchiveType>>) {
  const html = `<div style="
    width:26px;height:26px;
    background:${archiveType.color};
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 1px 5px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
    font-size:13px;line-height:1;
  ">${archiveType.emoji}</div>`;
  return L.divIcon({ html, iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -16], className: '' });
}

// ズームを上げると地名がラベルとして地図上に直接読める（Logainm.ie 方式）
const CHIMEI_LABEL_ZOOM = 15;

function createChimeiLabel(title: string, yomi: string | null, color: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<div style="
    display:inline-flex;flex-direction:column;align-items:center;
    background:rgba(255,255,255,0.94);
    border:1.5px solid ${color};
    border-radius:8px;padding:3px 9px;
    box-shadow:0 1px 5px rgba(0,0,0,0.25);
    white-space:nowrap;transform:translate(-50%,-50%);
  ">
    <span style="font-size:13px;font-weight:800;color:#222;">${esc(title)}</span>
    ${yomi ? `<span style="font-size:10px;color:#888;">${esc(yomi)}</span>` : ''}
  </div>`;
  return L.divIcon({ html, iconSize: [0, 0], iconAnchor: [0, 0], popupAnchor: [0, -18], className: '' });
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
}

function LocateControl({ onLocate }: { onLocate?: (pos: [number, number]) => void }) {
  const map = useMap();
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    const btn = document.createElement('div');
    btn.className = 'leaflet-control leaflet-bar';
    btn.innerHTML = `<a href="#" title="現在地" style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;font-size:16px;text-decoration:none;color:#333;">📍</a>`;
    btn.onclick = (e) => {
      e.preventDefault();
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const latlng: [number, number] = [p.coords.latitude, p.coords.longitude];
          setPos(latlng);
          map.setView(latlng, 17);
          onLocate?.(latlng);
        },
        undefined,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };
    const container = document.createElement('div');
    container.className = 'leaflet-top leaflet-right';
    container.style.marginTop = '60px';
    container.appendChild(btn);
    map.getContainer().appendChild(container);
    return () => { container.remove(); };
  }, [map, onLocate]);

  if (!pos) return null;
  return (
    <>
      <Circle center={pos} radius={30}
        pathOptions={{ color: '#4A90E2', fillColor: '#4A90E2', fillOpacity: 0.15, weight: 1 }} />
      <Circle center={pos} radius={6}
        pathOptions={{ color: '#fff', fillColor: '#4A90E2', fillOpacity: 1, weight: 2 }} />
    </>
  );
}

// 全体マップから直接ピンを立てるモード用：タップ位置を拾ってコールバックする
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMapClick?.(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

interface Props {
  traces: Trace[];
  mode?: 'pin' | 'heat';
  center?: [number, number];
  zoom?: number;
  flyTo?: [number, number];
  flyToZoom?: number;
  fitBounds?: [[number, number], [number, number]];
  routeLine?: [number, number][];
  highlightIds?: string[];
  onLocate?: (pos: [number, number]) => void;
  onTraceClick?: (trace: Trace) => void;
  onMapClick?: (lat: number, lng: number) => void;
  pinDropPos?: [number, number] | null;
  reactionCounts?: Record<string, number>;
  currentUserId?: string | null;
  teamColors?: Record<string, string>;
  avatarUrls?: Record<string, string>;
  // 個人の踏破マップ（プロフィールpage）、およびイベントページ（山手線一周など町の縮尺を超える範囲を扱うイベント）に限定した例外。
  // 通常の発見用ヒートマップ（/map, /region等）では絶対に使わないこと（「全国地図が薄まる」問題の回避策と矛盾するため）。
  allowWideZoom?: boolean;
  // イベントのスタート・ゴール地点など、感情ピンとは別に立てる固定ラベル付きマーカー
  pins?: { lat: number; lng: number; emoji: string; color: string; label: string }[];
  // スタート・ゴールの間の経由地点（番号つきピン）。routeLineと組み合わせて経路を線で見せる
  waypoints?: { lat: number; lng: number; label: string }[];
}

export default function TraceMap({ traces, mode = 'pin', center, zoom = 15, flyTo, flyToZoom, fitBounds, routeLine, highlightIds, onLocate, onTraceClick, onMapClick, pinDropPos, reactionCounts, currentUserId, teamColors, avatarUrls, allowWideZoom, pins, waypoints }: Props) {
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const fallback: [number, number] = [35.681236, 139.767125];
  const computedCenter: [number, number] =
    center ??
    (traces.length > 0
      ? [
          traces.reduce((s, t) => s + t.latitude, 0) / traces.length,
          traces.reduce((s, t) => s + t.longitude, 0) / traces.length,
        ]
      : fallback);

  return (
    <MapContainer
      center={computedCenter}
      zoom={zoom}
      minZoom={allowWideZoom ? undefined : MIN_TOWN_SCALE_ZOOM}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocateControl onLocate={onLocate} />
      <FlyToHandler pos={flyTo} zoom={flyToZoom} bounds={fitBounds} />
      <ZoomTracker onZoom={setCurrentZoom} />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      {pinDropPos && (
        <Marker position={pinDropPos} icon={createEmotionPin(null)} />
      )}

      {routeLine && routeLine.length >= 2 && (
        <Polyline positions={routeLine} pathOptions={{ color: '#38ADA9', weight: 3, dashArray: '2 10' }} />
      )}
      {highlightIds && traces.filter(t => highlightIds.includes(t.id)).map(t => (
        <Circle key={`hl-${t.id}`} center={[t.latitude, t.longitude]} radius={35}
          pathOptions={{ color: '#38ADA9', fillColor: '#38ADA9', fillOpacity: 0.15, weight: 2 }} />
      ))}
      {pins && pins.map((p, i) => (
        <Marker key={`pin-${i}`} position={[p.lat, p.lng]} icon={createFlagPin(p.emoji, p.color)}>
          <Popup>{p.label}</Popup>
        </Marker>
      ))}
      {waypoints && waypoints.map((w, i) => (
        <Marker key={`wp-${i}`} position={[w.lat, w.lng]} icon={createWaypointPin(i + 1)}>
          <Popup>{w.label || `経由地点${i + 1}`}</Popup>
        </Marker>
      ))}

      {mode === 'heat'
        ? traces.filter(t => !t.archive_type).map((t) => {
            const color = getEmotionColor(t.emotion_key);
            const reactionCount = reactionCounts?.[t.id] ?? 0;
            // 誰かが共感するほど、その痕跡のヒートは濃く・広くなる
            const radius = 44 * (t.intensity ?? 3) * (1 + Math.min(reactionCount, 10) * 0.15);
            // 情報を詰め込むヒートマップではなく、感情が積み重なるキャンバスの印象にするため、単体の主張は抑えめに・重なりで濃さが出るようにする
            const fillOpacity = Math.min(0.18 + reactionCount * 0.035, 0.6);
            return (
              <Circle key={t.id} center={[t.latitude, t.longitude]} radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity, weight: 0 }} />
            );
          })
        : (
        <MarkerClusterGroup chunkedLoading maxClusterRadius={60} spiderfyOnMaxZoom>
        {traces.map((t) => {
            const archiveType = getArchiveType(t.archive_type);
            const emotion = archiveType ? null : getEmotion(t.emotion_key);
            const category = archiveType ? null : getCategory(t.category);
            const voiceRelation = getVoiceRelation(t.voice_relation);
            const reactionCount = reactionCounts?.[t.id] ?? 0;
            const isMine = Boolean(currentUserId) && t.user_id === currentUserId;
            const teamColor = teamColors && t.team ? teamColors[t.team] : undefined;
            const avatarUrl = t.user_id ? avatarUrls?.[t.user_id] : undefined;
            const icon = archiveType
              ? (archiveType.key === 'chimei' && currentZoom >= CHIMEI_LABEL_ZOOM
                  ? createChimeiLabel(t.title, t.yomi, archiveType.color)
                  : createArchivePin(archiveType))
              : (t.photo_url && currentZoom >= PHOTO_THUMB_ZOOM
                  ? createPhotoPin(t.photo_url, teamColor ?? getEmotionColor(t.emotion_key), isMine, avatarUrl)
                  : createEmotionPin(t.emotion_key, reactionCount, isMine, teamColor, avatarUrl));
            const sourceIsUrl = !!t.source_ref && /^https?:\/\//.test(t.source_ref);
            return (
              <Marker key={t.id} position={[t.latitude, t.longitude]} icon={icon}>
                <Popup minWidth={220} maxWidth={260}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {t.photo_url && (
                      <img src={t.photo_url} alt={t.title} loading="lazy"
                        style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 130 }} />
                    )}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {t.team && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 20,
                          background: (teamColor ?? '#8E44AD') + '22', color: teamColor ?? '#8E44AD', fontSize: 11, fontWeight: 700,
                        }}>🏳 {t.team}</span>
                      )}
                      {archiveType && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 20,
                          background: archiveType.color + '22', color: archiveType.color, fontSize: 11, fontWeight: 700,
                        }}>{archiveType.emoji} {archiveType.label}</span>
                      )}
                      {emotion && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 20,
                          background: emotion.color + '22', color: emotion.color, fontSize: 11, fontWeight: 700,
                        }}>{emotion.emoji} {emotion.label}</span>
                      )}
                      {category && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 20,
                          background: '#f0f0f0', color: '#666', fontSize: 11,
                        }}>{category.emoji} {category.label}</span>
                      )}
                    </div>
                    {!archiveType && t.intensity && (
                      <span style={{ fontSize: 11, color: '#bbb' }}>
                        {'●'.repeat(t.intensity)}{'○'.repeat(5 - t.intensity)}
                      </span>
                    )}
                    {reactionCount > 0 && (
                      <span style={{ fontSize: 11, color: '#FF6B9D', fontWeight: 700 }}>
                        🔥 共感 {reactionCount}
                      </span>
                    )}
                    <strong style={{ fontSize: 13 }}>
                      {t.title}
                      {t.yomi && <span style={{ fontWeight: 400, color: '#999', fontSize: 11 }}>（{t.yomi}）</span>}
                    </strong>
                    {(t.era_label || voiceRelation) && (
                      <span style={{ fontSize: 11, color: '#888' }}>
                        {[t.era_label, voiceRelation ? `語り手：${voiceRelation.label}` : null].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {t.why && <p style={{ margin: 0, fontSize: 12, color: '#555' }}>{t.why}</p>}
                    {t.audio_url && (
                      <audio controls src={t.audio_url} style={{ width: '100%', height: 32 }} />
                    )}
                    {t.video_url && (
                      <video controls src={t.video_url} style={{ width: '100%', maxHeight: 130, borderRadius: 6, background: '#000' }} />
                    )}
                    {t.source_ref && (
                      sourceIsUrl ? (
                        <a href={t.source_ref} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: '#2E86C1', wordBreak: 'break-all' }}>
                          📚 {t.source_ref}
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: '#888' }}>📚 {t.source_ref}</span>
                      )
                    )}
                    {onTraceClick && (
                      <button
                        onClick={() => onTraceClick(t)}
                        style={{
                          marginTop: 2, padding: '6px 0', background: 'none',
                          border: 'none', color: '#FF6B9D', fontWeight: 700,
                          fontSize: 12, cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        くわしく見る →
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
        )}
    </MapContainer>
  );
}
