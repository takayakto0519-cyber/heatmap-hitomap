'use client';

import { useEffect, useState } from 'react';
import { getEmotion } from '@/lib/emotions';

interface Candidate {
  region: string;
  similarity: number;
  distanceKm: number;
  dominantEmotion: string | null;
  sampleTrace: { id: string; title: string; photo_url: string | null; why: string | null } | null;
}

interface Props {
  traceId: string;
}

function RegionCard({ c, tone }: { c: Candidate; tone: 'similar' | 'distant' }) {
  const emotion = getEmotion(c.dominantEmotion);
  return (
    <a
      href={`/region/${encodeURIComponent(c.region)}`}
      style={{
        flexShrink: 0, width: 150, textAlign: 'left', textDecoration: 'none',
        border: `1px solid ${tone === 'similar' ? '#FFD9E6' : '#E0E0F0'}`,
        borderRadius: 10, overflow: 'hidden', background: '#fff', display: 'block',
      }}
    >
      {c.sampleTrace?.photo_url ? (
        <img src={c.sampleTrace.photo_url} alt={c.sampleTrace.title} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{
          width: '100%', height: 80, background: (emotion?.color ?? '#ddd') + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{emotion?.emoji ?? '📍'}</div>
      )}
      <div style={{ padding: '8px 9px' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#333' }}>{c.region}</p>
        <p style={{ margin: '3px 0 0', fontSize: 10, color: '#aaa' }}>
          {c.distanceKm >= 1 ? `${c.distanceKm}km離れた町` : 'すぐ近くの町'}
        </p>
        {c.sampleTrace && (
          <p style={{
            margin: '4px 0 0', fontSize: 11, color: '#666',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{c.sampleTrace.title}</p>
        )}
      </div>
    </a>
  );
}

export default function ResonanceTowns({ traceId }: Props) {
  const [similar, setSimilar] = useState<Candidate[]>([]);
  const [distant, setDistant] = useState<Candidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/traces/${traceId}/resonance`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ok) return;
        setSimilar(d.similar ?? []);
        setDistant(d.distant ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [traceId]);

  if (!loaded || (similar.length === 0 && distant.length === 0)) return null;

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#444' }}>🔗 感情が共鳴する町</p>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#aaa' }}>離れていても、同じ心の震え方をした町がある</p>

      {similar.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: '#FF6B9D', fontWeight: 700 }}>💗 感情が近い町</p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {similar.map((c) => <RegionCard key={c.region} c={c} tone="similar" />)}
          </div>
        </div>
      )}

      {distant.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: '#6A89CC', fontWeight: 700 }}>🌊 感情が遠い町</p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {distant.map((c) => <RegionCard key={c.region} c={c} tone="distant" />)}
          </div>
        </div>
      )}
    </div>
  );
}
