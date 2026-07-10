'use client';

import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import type { Trace } from '@/lib/types';

function numberedIcon(n: number, visited: boolean) {
  const bg = visited ? '#bbb' : '#8E44AD';
  const html = `<div style="
    width:28px;height:28px;background:${bg};border:3px solid #fff;border-radius:50%;
    box-shadow:0 1px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;
    color:#fff;font-weight:800;font-size:13px;
  ">${n}</div>`;
  return L.divIcon({ html, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16], className: '' });
}

function FitToRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) map.fitBounds(positions, { padding: [30, 30] });
  }, [positions, map]);
  return null;
}

function flagIcon(emoji: string, color: string) {
  const html = `<div style="
    width:30px;height:30px;background:${color};border:3px solid #fff;
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    box-shadow:0 1px 5px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
  "><span style="transform:rotate(45deg);font-size:14px;">${emoji}</span></div>`;
  return L.divIcon({ html, iconSize: [30, 30], iconAnchor: [15, 29], popupAnchor: [0, -28], className: '' });
}

// 経由地点：投稿ピン（紫の丸数字）と見分けがつくよう、別色にする
function waypointIcon(n: number) {
  const html = `<div style="
    width:22px;height:22px;background:#38ADA9;border:2.5px solid #fff;border-radius:50%;
    box-shadow:0 1px 5px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;
    color:#fff;font-weight:800;font-size:10px;
  ">${n}</div>`;
  return L.divIcon({ html, iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -13], className: '' });
}

interface EventPoint { lat: number; lng: number; label: string }

interface Props {
  traces: Trace[];
  visitedIds?: string[];
  startPoint?: EventPoint | null;
  endPoint?: EventPoint | null;
  waypoints?: EventPoint[];
}

export default function RouteMap({ traces, visitedIds = [], startPoint, endPoint, waypoints = [] }: Props) {
  const positions: [number, number][] = traces.map(t => [t.latitude, t.longitude]);
  const eventLine: [number, number][] = [
    ...(startPoint ? [[startPoint.lat, startPoint.lng] as [number, number]] : []),
    ...waypoints.map((w): [number, number] => [w.lat, w.lng]),
    ...(endPoint ? [[endPoint.lat, endPoint.lng] as [number, number]] : []),
  ];
  const fitPositions: [number, number][] = [...positions, ...eventLine];
  const fallback: [number, number] = positions[0] ?? eventLine[0] ?? [35.681236, 139.767125];

  return (
    <MapContainer center={fallback} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToRoute positions={fitPositions} />
      <Polyline positions={positions} pathOptions={{ color: '#8E44AD', weight: 3, dashArray: '6 8' }} />
      {eventLine.length >= 2 && (
        <Polyline positions={eventLine} pathOptions={{ color: '#38ADA9', weight: 3, dashArray: '2 10' }} />
      )}
      {startPoint && (
        <Marker position={[startPoint.lat, startPoint.lng]} icon={flagIcon('🚩', '#27AE60')}>
          <Popup>{startPoint.label}</Popup>
        </Marker>
      )}
      {waypoints.map((w, i) => (
        <Marker key={`wp-${i}`} position={[w.lat, w.lng]} icon={waypointIcon(i + 1)}>
          <Popup>{w.label || `経由地点${i + 1}`}</Popup>
        </Marker>
      ))}
      {endPoint && (
        <Marker position={[endPoint.lat, endPoint.lng]} icon={flagIcon('🏁', '#E55039')}>
          <Popup>{endPoint.label}</Popup>
        </Marker>
      )}
      {traces.map((t, i) => (
        <Marker key={t.id} position={[t.latitude, t.longitude]} icon={numberedIcon(i + 1, visitedIds.includes(t.id))}>
          <Popup>
            <strong>{i + 1}. {t.title}</strong>
            {t.why && <p style={{ margin: '4px 0 0', fontSize: 12 }}>{t.why}</p>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
