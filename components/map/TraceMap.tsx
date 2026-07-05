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

function createEmotionPin(emotionKey: string | null) {
  const color = getEmotionColor(emotionKey);
  const html = `<div style="
    width:22px;height:22px;
    background:${color};
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 1px 5px rgba(0,0,0,0.4);
  "></div>`;
  return L.divIcon({ html, iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14], className: '' });
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
}

export default function TraceMap({ traces, mode = 'pin', center, zoom = 15, flyTo, flyToZoom, fitBounds, routeLine, highlightIds, onLocate, onTraceClick }: Props) {
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

      {routeLine && routeLine.length >= 2 && (
        <Polyline positions={routeLine} pathOptions={{ color: '#38ADA9', weight: 3, dashArray: '2 10' }} />
      )}
      {highlightIds && traces.filter(t => highlightIds.includes(t.id)).map(t => (
        <Circle key={`hl-${t.id}`} center={[t.latitude, t.longitude]} radius={35}
          pathOptions={{ color: '#38ADA9', fillColor: '#38ADA9', fillOpacity: 0.15, weight: 2 }} />
      ))}

      {mode === 'heat'
        ? traces.filter(t => !t.archive_type).map((t) => {
            const color = getEmotionColor(t.emotion_key);
            const radius = 40 * (t.intensity ?? 3);
            return (
              <Circle key={t.id} center={[t.latitude, t.longitude]} radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.28, weight: 0 }} />
            );
          })
        : (
        <MarkerClusterGroup chunkedLoading maxClusterRadius={60} spiderfyOnMaxZoom>
        {traces.map((t) => {
            const archiveType = getArchiveType(t.archive_type);
            const emotion = archiveType ? null : getEmotion(t.emotion_key);
            const category = archiveType ? null : getCategory(t.category);
            const voiceRelation = getVoiceRelation(t.voice_relation);
            const icon = archiveType
              ? (archiveType.key === 'chimei' && currentZoom >= CHIMEI_LABEL_ZOOM
                  ? createChimeiLabel(t.title, t.yomi, archiveType.color)
                  : createArchivePin(archiveType))
              : createEmotionPin(t.emotion_key);
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
