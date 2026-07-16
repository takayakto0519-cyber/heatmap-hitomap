'use client';

// ============================================================
// 煩悩オークション：BONNO投資ボード（投影用・黒背景）
// total_bonno（BONNO投資合計）の降順でランキング表示する。
// 1位には「本日の最高落札煩悩」ラベルを表示する（AI分析による「切実さ」は廃止済み）。
// 複数日にまたがる開催を想定し、期間タブ（今日／一週間／総合）で表示を切り替えられる。
// デフォルトは一週間。2.5秒ポーリングで、投資が進むほどランキングがライブに動く。
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from '@/lib/types';

interface BoardItem {
  id: string;
  text: string;
  nickname: string | null;
  total_bonno: number;
  created_at: string;
}

type Period = 'today' | 'week' | 'all';

const POLL_MS = 2500;
const PERIOD_LABELS: Record<Period, string> = { today: '今日', week: '一週間', all: '総合' };
const TOP_LABELS: Record<Period, string> = {
  today: '🏆 本日の最高落札煩悩',
  week: '🏆 今週の最高落札煩悩',
  all: '🏆 歴代最高落札煩悩',
};

export default function BonnoBoard({ route }: { route: Route }) {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [period, setPeriod] = useState<Period>('week');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bonno?event_slug=${encodeURIComponent(route.event_slug ?? '')}&period=${period}`);
      const data = await res.json();
      if (data.ok) setItems(data.items as BoardItem[]);
    } catch {
      // 瞬断は次のポーリングで回復
    }
  }, [route.event_slug, period]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const ranked = useMemo(
    () => items.slice().sort((a, b) => (b.total_bonno ?? 0) - (a.total_bonno ?? 0)),
    [items]
  );
  const totalBonno = useMemo(() => items.reduce((sum, it) => sum + (it.total_bonno ?? 0), 0), [items]);
  const top = ranked[0];
  const maxBonno = top?.total_bonno ?? 1;

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 50% 0%, #14140e 0%, #0a0a08 70%)',
      color: '#E8E0CC',
      padding: '40px 5vw 80px',
      fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
    }}>
      <p style={{ fontSize: 13, letterSpacing: 4, color: '#8F8770', margin: '0 0 6px' }}>BONNO投資ボード</p>
      <h1 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 700, margin: '0 0 8px', letterSpacing: 2 }}>
        {route.title}
      </h1>
      <p style={{ fontSize: 14, color: '#8F8770', margin: '0 0 20px' }}>
        奉納 {items.length} 件 ・ 総投資 {totalBonno} BONNO
      </p>

      {/* 期間タブ：複数日開催を想定し、今日／一週間／総合を切り替えられる */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 40 }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 2,
              padding: '8px 20px',
              borderRadius: 999,
              border: `1px solid ${period === p ? '#D6C8A0' : 'rgba(232, 224, 204, 0.25)'}`,
              background: period === p ? 'rgba(214, 200, 160, 0.14)' : 'transparent',
              color: period === p ? '#F2EBD8' : '#8F8770',
              cursor: 'pointer',
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {ranked.length === 0 || totalBonno === 0 ? (
        <p style={{ color: '#5C574A', fontSize: 18, letterSpacing: 4, textAlign: 'center', padding: '80px 0' }}>
          まだ誰も投資していません
        </p>
      ) : (
        <>
          {/* 1位：本日の最高落札煩悩 */}
          {top && (top.total_bonno ?? 0) > 0 && (
            <section style={{
              maxWidth: 780,
              margin: '0 auto 48px',
              textAlign: 'center',
              border: '1px solid #D6C8A0',
              borderRadius: 20,
              padding: '32px 28px',
              background: 'rgba(214, 200, 160, 0.06)',
            }}>
              <p style={{ fontSize: 15, letterSpacing: 5, color: '#D6C8A0', margin: '0 0 20px' }}>
                {TOP_LABELS[period]}
              </p>
              <p style={{
                fontSize: 'clamp(24px, 3.6vw, 44px)',
                lineHeight: 1.7,
                letterSpacing: 2,
                color: '#F2EBD8',
                margin: '0 0 20px',
                whiteSpace: 'pre-wrap',
              }}>
                {top.text}
              </p>
              <p style={{ fontSize: 16, color: '#A89E82', margin: 0, letterSpacing: 3 }}>
                — {top.nickname ?? '匿名'} ・ 💰 {top.total_bonno} BONNO
              </p>
            </section>
          )}

          {/* ランキング */}
          <section style={{ maxWidth: 780, margin: '0 auto' }}>
            <h2 style={{ fontSize: 15, letterSpacing: 4, color: '#A89E82', margin: '0 0 20px', fontWeight: 400 }}>
              ── ランキング
            </h2>
            {ranked.filter((it) => (it.total_bonno ?? 0) > 0).map((it, i) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <span style={{ width: 30, fontSize: 17, color: i < 3 ? '#D6C8A0' : '#8F8770', textAlign: 'right', fontWeight: 700 }}>
                  {i + 1}
                </span>
                <span style={{
                  flex: '0 1 340px',
                  fontSize: 16,
                  letterSpacing: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {it.text}
                </span>
                <div style={{ flex: 1, height: 16, background: 'rgba(232, 224, 204, 0.08)', borderRadius: 8 }}>
                  <div style={{
                    width: `${((it.total_bonno ?? 0) / maxBonno) * 100}%`,
                    height: '100%',
                    background: i < 3 ? '#D6C8A0' : '#566246',
                    borderRadius: 8,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
                <span style={{ width: 90, fontSize: 14, color: '#8F8770', textAlign: 'right' }}>
                  {it.total_bonno} BONNO
                </span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
