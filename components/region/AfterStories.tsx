'use client';

// その後の物語：この地域で「もう一度来た」記録（revisit_of つき）を集めて見せる。
// 一度きりの訪問で終わらず、再び足を運んだ縁こそが地域愛着の何よりの証拠。
// 訪問者にとっては物語の続きであり、自治体にとってはそのまま営業資材になる。
import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';

interface Props {
  traces: Trace[];
  onTraceClick?: (trace: Trace) => void;
}

export default function AfterStories({ traces, onTraceClick }: Props) {
  const byId = new Map(traces.map(t => [t.id, t]));
  const revisits = traces
    .filter(t => t.revisit_of)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (revisits.length === 0) return null;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>🔁 その後の物語（{revisits.length}件）</h2>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#999' }}>
        一度の訪問で終わらず、もう一度この町に足を運んだ人たちの記録です。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {revisits.map(t => {
          const original = t.revisit_of ? byId.get(t.revisit_of) : null;
          const emotion = getEmotion((t.emotion_keys ?? [t.emotion_key])[0] ?? null);
          return (
            <button key={t.id} type="button" onClick={() => onTraceClick?.(t)} style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: onTraceClick ? 'pointer' : 'default',
              border: '1px solid #EFE9DA', background: '#FDFBF5', fontFamily: 'inherit',
            }}>
              {original && (
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#A89D85' }}>
                  {fmt(original.created_at)}「{original.title}」から——
                </p>
              )}
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#55524A' }}>
                {emotion ? `${emotion.emoji} ` : ''}{t.title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>{fmt(t.created_at)} に再び</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
