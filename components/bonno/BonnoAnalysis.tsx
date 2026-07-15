'use client';

// ============================================================
// 煩悩オークション：AI分析ダッシュボード（投影用・黒背景）
// ・頻出ワード：タグクラウド＋横棒ランキング（ai_keywords を集計）
// ・切実さ：SVGバブルチャート（半径=切実さスコア、タップで本文表示）
// 2.5秒ポーリングで、AI分析が進むほどバブルとワードが増えていく。
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from '@/lib/types';

interface AnalysisItem {
  id: string;
  text: string;
  nickname: string | null;
  intensity_score: number | null;
  ai_keywords: string[] | null;
  created_at: string;
}

const POLL_MS = 2500;

// 苔の濃淡：切実さ1（淡い）→5（深い）
const INTENSITY_COLORS = ['#8A9474', '#75855C', '#566246', '#465238', '#37422B'];

// idから安定した疑似乱数（0〜1）を作る。ポーリングのたびにバブルが跳ねないようにする
function hashUnit(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export default function BonnoAnalysis({ route }: { route: Route }) {
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [selected, setSelected] = useState<AnalysisItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bonno?event_slug=${encodeURIComponent(route.event_slug ?? '')}`);
      const data = await res.json();
      if (data.ok) setItems(data.items as AnalysisItem[]);
    } catch {
      // 瞬断は次のポーリングで回復
    }
  }, [route.event_slug]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const analyzed = useMemo(() => items.filter((it) => it.intensity_score), [items]);

  // キーワード集計（出現回数順）
  const wordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) {
      for (const k of it.ai_keywords ?? []) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const maxCount = wordCounts[0]?.[1] ?? 1;

  // バブル配置：格子に置いて疑似乱数で揺らす（衝突計算なしで十分見られる密度にする）
  const bubbles = useMemo(() => {
    const n = analyzed.length;
    if (n === 0) return [];
    const cols = Math.ceil(Math.sqrt(n * (1000 / 560)));
    const rows = Math.ceil(n / cols);
    const cellW = 1000 / cols;
    const cellH = 560 / rows;
    return analyzed.map((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const score = it.intensity_score ?? 3;
      return {
        item: it,
        x: cellW * col + cellW * (0.3 + hashUnit(it.id, 7) * 0.4),
        y: cellH * row + cellH * (0.3 + hashUnit(it.id, 13) * 0.4),
        r: Math.min(14 + score * 10, Math.min(cellW, cellH) * 0.48),
        color: INTENSITY_COLORS[score - 1] ?? INTENSITY_COLORS[2],
      };
    });
  }, [analyzed]);

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 50% 0%, #14140e 0%, #0a0a08 70%)',
      color: '#E8E0CC',
      padding: '40px 5vw 80px',
      fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
    }}>
      <p style={{ fontSize: 13, letterSpacing: 4, color: '#8F8770', margin: '0 0 6px' }}>煩悩の解析</p>
      <h1 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 700, margin: '0 0 8px', letterSpacing: 2 }}>
        {route.title}
      </h1>
      <p style={{ fontSize: 14, color: '#8F8770', margin: '0 0 40px' }}>
        奉納 {items.length} 件 ・ 解析済み {analyzed.length} 件
      </p>

      {wordCounts.length === 0 && analyzed.length === 0 ? (
        <p style={{ color: '#5C574A', fontSize: 18, letterSpacing: 4, textAlign: 'center', padding: '80px 0' }}>
          AI分析の実行を待っています
        </p>
      ) : (
        <>
          {/* タグクラウド */}
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 15, letterSpacing: 4, color: '#A89E82', margin: '0 0 24px', fontWeight: 400 }}>
              ── みんなの煩悩に宿る言葉
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '10px 26px', justifyContent: 'center', padding: '0 2vw' }}>
              {wordCounts.slice(0, 40).map(([word, count]) => (
                <span key={word} style={{
                  fontSize: 14 + Math.min(count, 10) * 6,
                  color: count >= maxCount * 0.6 ? '#F2EBD8' : count >= maxCount * 0.3 ? '#C4B896' : '#8F8770',
                  letterSpacing: 2,
                  lineHeight: 1.4,
                }}>
                  {word}
                </span>
              ))}
            </div>
          </section>

          {/* ランキング */}
          {wordCounts.length > 0 && (
            <section style={{ marginBottom: 56, maxWidth: 680, marginLeft: 'auto', marginRight: 'auto' }}>
              <h2 style={{ fontSize: 15, letterSpacing: 4, color: '#A89E82', margin: '0 0 20px', fontWeight: 400 }}>
                ── 頻出ワード
              </h2>
              {wordCounts.slice(0, 10).map(([word, count], i) => (
                <div key={word} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                  <span style={{ width: 28, fontSize: 15, color: i < 3 ? '#D6C8A0' : '#8F8770', textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ width: 130, fontSize: 16, letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{word}</span>
                  <div style={{ flex: 1, height: 14, background: 'rgba(232, 224, 204, 0.08)', borderRadius: 7 }}>
                    <div style={{
                      width: `${(count / maxCount) * 100}%`,
                      height: '100%',
                      background: i < 3 ? '#8A9474' : '#566246',
                      borderRadius: 7,
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                  <span style={{ width: 40, fontSize: 14, color: '#8F8770' }}>{count}回</span>
                </div>
              ))}
            </section>
          )}

          {/* 切実さバブル */}
          {analyzed.length > 0 && (
            <section>
              <h2 style={{ fontSize: 15, letterSpacing: 4, color: '#A89E82', margin: '0 0 8px', fontWeight: 400 }}>
                ── 煩悩の大きさ（円が大きいほど切実）
              </h2>
              <p style={{ fontSize: 12, color: '#5C574A', margin: '0 0 16px' }}>円に触れると本文が読めます</p>
              <svg viewBox="0 0 1000 560" style={{ width: '100%', height: 'auto', display: 'block' }}>
                {bubbles.map(({ item, x, y, r, color }) => (
                  <g key={item.id} onClick={() => setSelected(item)} style={{ cursor: 'pointer' }}>
                    <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.85} stroke="#D6C8A0" strokeOpacity={0.25} strokeWidth={1.5}>
                      <title>{item.text}</title>
                    </circle>
                    {r >= 40 && (
                      <text x={x} y={y + 5} textAnchor="middle" fill="#F2EBD8" fontSize={13} style={{ pointerEvents: 'none' }}>
                        {item.text.slice(0, Math.floor(r / 7))}{item.text.length > Math.floor(r / 7) ? '…' : ''}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </section>
          )}
        </>
      )}

      {/* バブルタップで本文表示 */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10, 10, 8, 0.9)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '0 8vw', textAlign: 'center', cursor: 'pointer',
          }}
        >
          <p style={{ fontSize: 'clamp(24px, 4vw, 52px)', lineHeight: 1.8, letterSpacing: 2, color: '#F2EBD8', margin: 0, whiteSpace: 'pre-wrap' }}>
            {selected.text}
          </p>
          <p style={{ fontSize: 16, color: '#A89E82', margin: '28px 0 0', letterSpacing: 3 }}>
            — {selected.nickname ?? '匿名'} ・ 切実さ {'●'.repeat(selected.intensity_score ?? 0)}{'○'.repeat(5 - (selected.intensity_score ?? 0))}
          </p>
        </div>
      )}
    </main>
  );
}
