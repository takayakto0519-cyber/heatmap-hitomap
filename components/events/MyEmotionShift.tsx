'use client';

// 本人限定「イベント前後のわたしの感情」：
// 人と会う前の感情・会っているときの感情・会った後の感情を、
// 絵文字の川と valence×強度のグラデーションバーで辿れるようにする。
// - マイナスの感情は赤く、強いほど濃く。プラスは感情固有の明るい色（lib/emotions.ts の共通変換）
// - before→after の変化は矢印＋型抜きの物語文（AI呼び出しなし・コード固定）
// - データは /api/events/[slug]/my-shift（認証必須・本人の記録のみ）から取得。
//   参加者でない・未ログインなら何も描画しない。
import { useEffect, useState } from 'react';
import { getEmotion, getValenceGradientColor, getShiftColor, meanValence } from '@/lib/emotions';
import type { MyEventShiftResponse, MyShiftTrace } from '@/lib/types';

interface Props {
  slug: string;
}

const PHASES = [
  { key: 'before', label: '会う前', hint: 'イベントが始まる前' },
  { key: 'during', label: '会っているとき', hint: 'イベントのあいだ' },
  { key: 'after', label: '会った後', hint: 'イベントが終わってから' },
] as const;

function tracesValence(traces: MyShiftTrace[]): number | null {
  const keys = traces.flatMap((t) => t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []));
  return meanValence(keys);
}

// 型抜きの物語文：before→after の感情の向きを一文に（EnList の storyLine と同じ流儀）
function shiftStory(before: MyShiftTrace[], after: MyShiftTrace[]): { text: string; delta: number } | null {
  const bv = tracesValence(before);
  const av = tracesValence(after);
  if (bv === null || av === null) return null;
  const delta = av - bv;
  if (delta > 0.05) return { text: 'このイベントを経て、あなたの感情はあたたかくなりました。', delta };
  if (delta < -0.05) return { text: 'このイベントを経て、あなたの想いは揺れています。それもまた、縁の証です。', delta };
  return { text: 'イベントの前も後も、あなたの感情は静かに続いています。', delta };
}

function emotionsOf(t: MyShiftTrace): string[] {
  return t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []);
}

export default function MyEmotionShift({ slug }: Props) {
  const [data, setData] = useState<MyEventShiftResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${encodeURIComponent(slug)}/my-shift`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: MyEventShiftResponse | null) => {
        if (!cancelled && d?.ok && d.participated) setData(d);
      })
      .catch(() => { /* 未ログイン・エラー時は何も出さない */ });
    return () => { cancelled = true; };
  }, [slug]);

  if (!data?.phases) return null;
  const { phases } = data;
  const story = shiftStory(phases.before, phases.after);
  const total = phases.before.length + phases.during.length + phases.after.length;
  if (total === 0) return null;

  return (
    <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      <style>{`
        @keyframes shift-river-in {
          from { opacity: 0; transform: translateY(5px) scale(0.7); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>🌱 イベント前後のわたしの感情</h2>
      <p style={{ margin: '0 0 14px', fontSize: 11, color: '#999' }}>
        人と会う前・会っているとき・会った後で、あなたの感情がどう動いたか。この比較はあなたにしか見えません。
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {PHASES.map(({ key, label, hint }) => {
          const list = phases[key];
          return (
            <div key={key} style={{ border: '1px solid #EFE9DA', borderRadius: 10, background: '#FDFBF5', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#55524A' }}>{label}</span>
                <span style={{ fontSize: 11, color: '#A89D85' }}>{list.length > 0 ? `${list.length}件の記録` : hint}</span>
              </div>

              {list.length === 0 ? (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#bbb' }}>記録はまだありません</p>
              ) : (
                <>
                  {/* 絵文字の川：時間順の感情が左から流れ込む */}
                  <div style={{ fontSize: 17, letterSpacing: 3, marginTop: 6 }}>
                    {list.length > 14 ? '…' : ''}
                    {list.slice(-14).map((t, i) => {
                      const e = getEmotion(emotionsOf(t)[0]);
                      return (
                        <span key={t.id} style={{ display: 'inline-block', animation: 'shift-river-in 0.4s ease-out both', animationDelay: `${i * 0.1}s` }}>
                          {e?.emoji ?? '・'}
                        </span>
                      );
                    })}
                  </div>
                  {/* 感情のグラデーションバー：各記録を valence×強度の色濃度で並べる。
                      マイナスな時期は薄い赤→濃い赤の帯として見える */}
                  <div style={{ display: 'flex', gap: 2, marginTop: 6, height: 10, borderRadius: 5, overflow: 'hidden' }}>
                    {list.slice(-28).map((t) => {
                      const { color, opacity } = getValenceGradientColor(emotionsOf(t), t.intensity);
                      return (
                        <span
                          key={t.id}
                          title={t.title}
                          style={{ flex: 1, background: color, opacity, minWidth: 4 }}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* before→after の変化：矢印＋物語文 */}
      {story && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: '#FBF7EC', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: getShiftColor(story.delta), flexShrink: 0 }}>
            {story.delta > 0.05 ? '↗' : story.delta < -0.05 ? '↘' : '→'}
          </span>
          <p style={{ margin: 0, fontSize: 12, color: '#8A6B3F', lineHeight: 1.7 }}>{story.text}</p>
        </div>
      )}
    </div>
  );
}
