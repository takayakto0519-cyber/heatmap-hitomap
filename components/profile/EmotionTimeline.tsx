'use client';

// プロフィール用：記録を時系列に並べ、感情の起伏を線で辿れるようにする。
// 「動線」そのもの（GPS移動軌跡）ではなく、その人がどんな感情の出会いを重ねてきたかの物語を可視化する。
// 地域チップで絞り込むと「この町であなたの感情がどう変わってきたか」＝地域愛着の軌跡が読める。
import { useState } from 'react';
import { getEmotion } from '@/lib/emotions';
import type { Trace } from '@/lib/types';

interface Props {
  traces: Trace[];
  onSelect?: (trace: Trace) => void;
}

function valenceY(t: Trace): number {
  const keys = t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []);
  const emotions = keys.map(getEmotion).filter((e): e is NonNullable<typeof e> => e !== null);
  if (emotions.length === 0) return 0;
  const avg = emotions.reduce((sum, e) => sum + e.valence, 0) / emotions.length;
  return avg; // -1 〜 1
}

export default function EmotionTimeline({ traces, onSelect }: Props) {
  const [regionFilter, setRegionFilter] = useState<string | null>(null);

  const eligible = traces.filter(t => !t.archive_type); // 感情タグを持つ「痕跡」のみ対象（地名・言い伝え等のアーカイブは除く）

  // 記録数の多い順に地域チップを出す（2地域以上あるときだけ。1地域なら絞り込みは無意味）
  const regionCounts = new Map<string, number>();
  for (const t of eligible) {
    if (t.region) regionCounts.set(t.region, (regionCounts.get(t.region) ?? 0) + 1);
  }
  const regions = [...regionCounts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);

  const sorted = eligible
    .filter(t => !regionFilter || t.region === regionFilter)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (eligible.length < 2) return null;

  const trackHeight = 100;
  const pointGap = 64;
  const width = Math.max(sorted.length * pointGap, 240);

  return (
    <div>
      {regions.length >= 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button type="button" onClick={() => setRegionFilter(null)} style={{
            padding: '4px 10px', borderRadius: 14, fontSize: 11, cursor: 'pointer',
            border: `1.5px solid ${regionFilter === null ? '#38ADA9' : '#ddd'}`,
            background: regionFilter === null ? '#38ADA9' : '#fff',
            color: regionFilter === null ? '#fff' : '#888', fontWeight: 700,
          }}>すべて</button>
          {regions.map(r => (
            <button key={r} type="button" onClick={() => setRegionFilter(regionFilter === r ? null : r)} style={{
              padding: '4px 10px', borderRadius: 14, fontSize: 11, cursor: 'pointer',
              border: `1.5px solid ${regionFilter === r ? '#38ADA9' : '#ddd'}`,
              background: regionFilter === r ? '#38ADA9' : '#fff',
              color: regionFilter === r ? '#fff' : '#888', fontWeight: regionFilter === r ? 700 : 400,
            }}>{r}（{regionCounts.get(r)}）</button>
          ))}
        </div>
      )}

      {sorted.length < 2 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
          この地域の記録はまだ{sorted.length}件です。2件以上になると感情の軌跡が描かれます。
        </p>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <svg width={width} height={trackHeight} style={{ display: 'block' }}>
            <line x1={0} y1={trackHeight / 2} x2={width} y2={trackHeight / 2} stroke="#eee" strokeWidth={1} />
            <polyline
              fill="none"
              stroke="#C9A0A8"
              strokeWidth={1.5}
              points={sorted.map((t, i) => `${i * pointGap + pointGap / 2},${trackHeight / 2 - valenceY(t) * 34}`).join(' ')}
            />
            {sorted.map((t, i) => {
              const keys = t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []);
              const emotion = getEmotion(keys[0]);
              const cx = i * pointGap + pointGap / 2;
              const cy = trackHeight / 2 - valenceY(t) * 34;
              return (
                <g key={t.id} onClick={() => onSelect?.(t)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                  <title>{`${t.title}（${new Date(t.created_at).toLocaleDateString('ja-JP')}）${emotion ? ' ・ ' + emotion.label : ''}${t.region ? ' ・ ' + t.region : ''}`}</title>
                  <circle cx={cx} cy={cy} r={5} fill={emotion?.color ?? '#ccc'} stroke="#fff" strokeWidth={1.5} />
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
