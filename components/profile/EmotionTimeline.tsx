// プロフィール用：記録を時系列に並べ、感情の起伏を線で辿れるようにする。
// 「動線」そのもの（GPS移動軌跡）ではなく、その人がどんな感情の出会いを重ねてきたかの物語を可視化する。
import { getEmotion } from '@/lib/emotions';
import type { Trace } from '@/lib/types';

interface Props {
  traces: Trace[];
  onSelect?: (trace: Trace) => void;
}

function valenceY(traces: Trace[], t: Trace): number {
  const keys = t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []);
  const emotions = keys.map(getEmotion).filter((e): e is NonNullable<typeof e> => e !== null);
  if (emotions.length === 0) return 0;
  const avg = emotions.reduce((sum, e) => sum + e.valence, 0) / emotions.length;
  return avg; // -1 〜 1
}

export default function EmotionTimeline({ traces, onSelect }: Props) {
  const sorted = [...traces]
    .filter(t => !t.archive_type) // 感情タグを持つ「痕跡」のみ対象（地名・言い伝え等のアーカイブは除く）
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (sorted.length < 2) return null;

  const trackHeight = 100;
  const pointGap = 64;
  const width = Math.max(sorted.length * pointGap, 240);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <svg width={width} height={trackHeight} style={{ display: 'block' }}>
        <line x1={0} y1={trackHeight / 2} x2={width} y2={trackHeight / 2} stroke="#eee" strokeWidth={1} />
        <polyline
          fill="none"
          stroke="#C9A0A8"
          strokeWidth={1.5}
          points={sorted.map((t, i) => `${i * pointGap + pointGap / 2},${trackHeight / 2 - valenceY(sorted, t) * 34}`).join(' ')}
        />
        {sorted.map((t, i) => {
          const keys = t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []);
          const emotion = getEmotion(keys[0]);
          const cx = i * pointGap + pointGap / 2;
          const cy = trackHeight / 2 - valenceY(sorted, t) * 34;
          return (
            <g key={t.id} onClick={() => onSelect?.(t)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
              <title>{`${t.title}（${new Date(t.created_at).toLocaleDateString('ja-JP')}）${emotion ? ' ・ ' + emotion.label : ''}`}</title>
              <circle cx={cx} cy={cy} r={5} fill={emotion?.color ?? '#ccc'} stroke="#fff" strokeWidth={1.5} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
