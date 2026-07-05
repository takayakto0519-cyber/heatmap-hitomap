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

interface Props {
  traces: Trace[];
  visitedIds?: string[];
}

export default function RouteMap({ traces, visitedIds = [] }: Props) {
  const positions: [number, number][] = traces.map(t => [t.latitude, t.longitude]);
  const fallback: [number, number] = positions[0] ?? [35.681236, 139.767125];

  return (
    <MapContainer center={fallback} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToRoute positions={positions} />
      <Polyline positions={positions} pathOptions={{ color: '#8E44AD', weight: 3, dashArray: '6 8' }} />
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
