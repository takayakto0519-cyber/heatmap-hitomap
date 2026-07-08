'use client';

import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';

interface Props {
  traces: Trace[];
  onTraceClick: (trace: Trace) => void;
}

interface Bucket {
  label: string;
  traces: Trace[];
  dominant: ReturnType<typeof getEmotion>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildBuckets(traces: Trace[]): Bucket[] {
  const sorted = [...traces].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (sorted.length === 0) return [];

  // 投稿数に応じて4〜6区間程度に自動でまとめる。データが少ない場合は無理に分けない。
  const bucketCount = Math.max(1, Math.min(6, Math.ceil(sorted.length / 3)));
  const size = Math.ceil(sorted.length / bucketCount);

  const buckets: Bucket[] = [];
  for (let i = 0; i < sorted.length; i += size) {
    const chunk = sorted.slice(i, i + size);
    const counts: Record<string, number> = {};
    for (const t of chunk) {
      if (t.emotion_key) counts[t.emotion_key] = (counts[t.emotion_key] ?? 0) + 1;
    }
    const topKey = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    const label = formatDate(first.created_at) === formatDate(last.created_at)
      ? formatDate(first.created_at)
      : `${formatDate(first.created_at)}〜${formatDate(last.created_at)}`;
    buckets.push({ label, traces: chunk, dominant: getEmotion(topKey) });
  }
  return buckets;
}

function buildSummary(buckets: Bucket[]): string | null {
  const withDominant = buckets.filter(b => b.dominant);
  if (withDominant.length < 2) return null;
  const first = withDominant[0].dominant!;
  const last = withDominant[withDominant.length - 1].dominant!;
  if (first.key === last.key) {
    return `この地域では一貫して${first.emoji}「${first.label}」を感じる投稿が多く見られます。`;
  }
  return `この地域は最初は${first.emoji}「${first.label}」が多かったが、最近は${last.emoji}「${last.label}」が増えています。`;
}

export default function RegionTimeline({ traces, onTraceClick }: Props) {
  const buckets = buildBuckets(traces.filter(t => !t.archive_type));
  if (buckets.length < 2) return null;

  const summary = buildSummary(buckets);

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#444' }}>🕰 この地域の変遷</p>
      {summary && (
        <p style={{
          margin: '0 0 10px', fontSize: 13, color: '#38ADA9', background: '#E8F8F7',
          padding: '10px 12px', borderRadius: 10, lineHeight: 1.6,
        }}>{summary}</p>
      )}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {buckets.map((b, i) => {
          const color = b.dominant?.color ?? '#bbb';
          const reps = [...b.traces].sort((a, c) => (c.photo_url ? 1 : 0) - (a.photo_url ? 1 : 0)).slice(0, 2);
          return (
            <div key={i} style={{
              flex: '0 0 auto', width: 150, background: '#fff', borderRadius: 12,
              border: `1.5px solid ${color}33`, borderTop: `4px solid ${color}`,
              padding: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, color: '#999', fontWeight: 700 }}>{b.label}</p>
              {b.dominant ? (
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color }}>
                  {b.dominant.emoji} {b.dominant.label}
                </p>
              ) : (
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#bbb' }}>（感情タグなし）</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {reps.map(t => (
                  <button key={t.id} onClick={() => onTraceClick(t)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.title} loading="lazy"
                        style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: 28, height: 28, borderRadius: 6, background: color + '22', flexShrink: 0 }} />
                    )}
                    <span style={{
                      fontSize: 11, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', flex: 1,
                    }}>{t.title}</span>
                  </button>
                ))}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 10, color: '#ccc' }}>{b.traces.length}件</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
