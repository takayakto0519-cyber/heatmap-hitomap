'use client';

import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import type { Trace } from '@/lib/types';
import { getEmotionColor, getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';

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
  onLocate?: (pos: [number, number]) => void;
  onTraceClick?: (trace: Trace) => void;
}

export default function TraceMap({ traces, mode = 'pin', center, zoom = 15, onLocate, onTraceClick }: Props) {
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

      {mode === 'heat'
        ? traces.map((t) => {
            const color = getEmotionColor(t.emotion_key);
            const radius = 40 * (t.intensity ?? 3);
            return (
              <Circle key={t.id} center={[t.latitude, t.longitude]} radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.28, weight: 0 }} />
            );
          })
        : traces.map((t) => {
            const emotion = getEmotion(t.emotion_key);
            const category = getCategory(t.category);
            return (
              <Marker key={t.id} position={[t.latitude, t.longitude]}
                icon={createEmotionPin(t.emotion_key)}>
                <Popup minWidth={220} maxWidth={260}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {t.photo_url && (
                      <img src={t.photo_url} alt={t.title} loading="lazy"
                        style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 130 }} />
                    )}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
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
                    {t.intensity && (
                      <span style={{ fontSize: 11, color: '#bbb' }}>
                        {'●'.repeat(t.intensity)}{'○'.repeat(5 - t.intensity)}
                      </span>
                    )}
                    <strong style={{ fontSize: 13 }}>{t.title}</strong>
                    {t.why && <p style={{ margin: 0, fontSize: 12, color: '#555' }}>{t.why}</p>}
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
    </MapContainer>
  );
}
