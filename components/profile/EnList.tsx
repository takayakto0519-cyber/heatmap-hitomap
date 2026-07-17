'use client';

// 縁の一覧：出会った人（companion_tag）ごとに、感情の変遷を「絵文字の川」で見せる。
// ヒトマップの本義＝出会い→感情→愛着の見える化を、人を軸にした最小の形にしたもの。
// - 一覧：名前・会った回数・最後に会った日・感情の向き（↗→↘）
// - 絵文字の川：その人との感情絵文字を時間順に並べるだけ。グラフより雄弁
// - 型抜きの物語文：テンプレート文で縁を一文に（AI呼び出しなし・コード固定）
// - 開くと「ひとりの人の物語」：記録の時系列と、共に歩いた場所の地図
// 自分のプロフィールでのみ表示する（他者の縁は見せない）。
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { getEmotion } from '@/lib/emotions';
import type { Trace } from '@/lib/types';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', color: '#aaa', fontSize: 12 }}>地図を読み込み中…</div>,
});

interface Props {
  traces: Trace[];
  onSelect?: (trace: Trace) => void;
}

interface Bond {
  name: string;          // companion_tag そのまま（表記ゆれの正規化はデータが増えてから）
  traces: Trace[];       // 時系列（古い順）
  firstAt: Date;
  lastAt: Date;
  trend: -1 | 0 | 1;     // 感情の向き：最初の記録と直近の記録の感情価を比べる
}

function traceValence(t: Trace): number | null {
  const keys = t.emotion_keys ?? (t.emotion_key ? [t.emotion_key] : []);
  const emotions = keys.map(getEmotion).filter((e): e is NonNullable<ReturnType<typeof getEmotion>> => e !== null);
  if (emotions.length === 0) return null;
  return emotions.reduce((sum, e) => sum + e.valence, 0) / emotions.length;
}

function firstEmotion(t: Trace) {
  return getEmotion((t.emotion_keys ?? [t.emotion_key])[0] ?? null);
}

// 型抜きの物語文：縁を一文に。テンプレートのみで生成する（サーバーAIは呼ばない）
function storyLine(bond: Bond): string {
  const first = firstEmotion(bond.traces[0]);
  const last = firstEmotion(bond.traces[bond.traces.length - 1]);
  const firstLabel = `${bond.firstAt.getFullYear()}年${bond.firstAt.getMonth() + 1}月`;
  if (bond.traces.length === 1) {
    return first
      ? `${firstLabel}に出会い、${first.emoji}${first.label}が残っています。`
      : `${firstLabel}に出会いました。`;
  }
  if (first && last && first.key !== last.key) {
    return `${firstLabel}に${first.emoji}${first.label}から始まり、${bond.traces.length}回の記録を重ね、いまは${last.emoji}${last.label}です。`;
  }
  return first
    ? `${firstLabel}から${bond.traces.length}回の記録。${first.emoji}${first.label}がずっと続いています。`
    : `${firstLabel}から${bond.traces.length}回の記録が重なっています。`;
}

const TREND = {
  1: { mark: '↗', color: '#E55039', label: 'あたたかくなっている' },
  0: { mark: '→', color: '#999', label: '変わらず' },
  [-1]: { mark: '↘', color: '#6A89CC', label: '想いが揺れている' },
} as const;

export default function EnList({ traces, onSelect }: Props) {
  const [openName, setOpenName] = useState<string | null>(null);

  // companion_tag ごとに束ねる（空・アーカイブ型は除く）
  const byName = new Map<string, Trace[]>();
  for (const t of traces) {
    const tag = t.companion_tag?.trim();
    if (!tag || t.archive_type) continue;
    if (!byName.has(tag)) byName.set(tag, []);
    byName.get(tag)!.push(t);
  }

  const bonds: Bond[] = [...byName.entries()].map(([name, list]) => {
    const sorted = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const firstV = traceValence(sorted[0]);
    const lastV = traceValence(sorted[sorted.length - 1]);
    const trend: -1 | 0 | 1 =
      firstV === null || lastV === null || sorted.length < 2 ? 0
        : lastV > firstV ? 1 : lastV < firstV ? -1 : 0;
    return {
      name,
      traces: sorted,
      firstAt: new Date(sorted[0].created_at),
      lastAt: new Date(sorted[sorted.length - 1].created_at),
      trend,
    };
  }).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime()); // 直近に会った人から

  if (bonds.length === 0) return null;

  const fmt = (d: Date) => d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      {/* 絵文字の川の流れ込みアニメーション */}
      <style>{`
        @keyframes en-river-in {
          from { opacity: 0; transform: translateY(5px) scale(0.7); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>🤝 縁の一覧（{bonds.length}人）</h2>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#999' }}>
        出会った人ごとに、感情がどう変わってきたかを辿れます。この一覧はあなたにしか見えません。
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bonds.map(bond => {
          const trend = TREND[bond.trend];
          const open = openName === bond.name;
          const river = bond.traces.map(firstEmotion).filter(Boolean).map(e => e!.emoji);
          const mappable = bond.traces.filter(t => t.latitude && t.longitude);
          return (
            <div key={bond.name} style={{ border: '1px solid #EFE9DA', borderRadius: 10, background: '#FDFBF5' }}>
              <button
                type="button"
                onClick={() => setOpenName(open ? null : bond.name)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '12px',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#55524A' }}>{bond.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: trend.color, flexShrink: 0 }} title={trend.label}>{trend.mark}</span>
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  {bond.traces.length}回 ・ 最後は{fmt(bond.lastAt)}
                </div>
                {/* 絵文字の川：時間順の感情が左から順に流れ込む（感情が積み重なった時間を動きで伝える） */}
                {river.length > 0 && (
                  <div style={{ fontSize: 17, letterSpacing: 3, marginTop: 6 }}>
                    {river.length > 14 ? '…' : ''}
                    {river.slice(-14).map((emoji, i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-block',
                          animation: 'en-river-in 0.4s ease-out both',
                          animationDelay: `${i * 0.1}s`,
                        }}
                      >{emoji}</span>
                    ))}
                  </div>
                )}
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#8A6B3F', lineHeight: 1.7 }}>{storyLine(bond)}</p>
              </button>

              {/* ひとりの人の物語：開くと時系列の記録と、共に歩いた場所 */}
              {open && (
                <div style={{ padding: '0 12px 12px' }}>
                  {mappable.length > 0 && (
                    <div style={{ height: 160, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                      <TraceMap
                        traces={mappable}
                        mode="pin"
                        allowWideZoom
                        center={[mappable[0].latitude, mappable[0].longitude]}
                        onTraceClick={onSelect}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {bond.traces.map((t, i) => {
                      const e = firstEmotion(t);
                      return (
                        <button key={t.id} type="button" onClick={() => onSelect?.(t)} style={{
                          textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: onSelect ? 'pointer' : 'default',
                          border: '1px solid #F0EADB', background: '#fff', fontFamily: 'inherit',
                        }}>
                          <span style={{ fontSize: 11, color: '#A89D85' }}>
                            {i === 0 ? '出会い' : t.revisit_of ? 'その後' : `${i + 1}回目`} ・ {fmt(new Date(t.created_at))}
                          </span>
                          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: '#55524A' }}>
                            {e ? `${e.emoji} ` : ''}{t.title}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
