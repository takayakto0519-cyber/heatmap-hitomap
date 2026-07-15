'use client';

// MVV演出「案B：全幅フォトエッセイ方式」（IKEUCHI ORGANIC / Aesop 参考）。
// position:sticky を項目数ぶん積み重ねるだけで、後続パネルが前のパネルの上に
// スクロールでせり出してくる「受け渡し」演出になる（JSでのスクロール計算は不要）。
// 背景はHeroと同じMapArt（地図アート）の別区画バリエーションを使い、
// 「同じ町の、違う場所」という一貫した世界観を保つ。
//
// 2026-07-15: NN/gのscrolljacking研究では、スクロール挙動を変える演出はユーザーの
// 操作感を損なうリスクがあると指摘されており、特にスマホでは86vh×3枚(約2.5画面分)を
// CTAなしでスクロールさせることになり離脱要因になり得る。そのためsticky積み重ねは
// デスクトップ(861px以上)限定とし、スマホでは通常の縦積みブロック（各枠は控えめな高さ）
// に切り替える。
import { useEffect, useRef, useState } from 'react';
import { corpColor, corpFont } from './tokens';
import MapArt from './MapArt';
import type { BlockCardItem } from '@/lib/siteBlocks';

function Panel({ item, index, panelId }: { item: BlockCardItem; index: number; panelId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setShown(true); }),
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tints = [corpColor.mossDeep, corpColor.ink, corpColor.moss] as const;

  return (
    <div
      ref={ref}
      className="hm-mvv-panel"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
        background: tints[index % tints.length],
      }}
    >
      <MapArt variant={(index % 3) as 0 | 1 | 2} id={panelId} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      <div
        className="hm-mvv-panel-copy"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
          opacity: shown ? 1 : 0,
          transform: shown ? 'none' : 'translateY(24px)',
          transition: 'opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 12,
            letterSpacing: '0.22em',
            color: corpColor.white,
            opacity: 0.85,
            fontFamily: corpFont.body,
            fontWeight: 700,
          }}
        >
          {item.title}
        </p>
        <h3
          style={{
            margin: 0,
            fontFamily: corpFont.mincho,
            fontSize: 'clamp(21px, 4vw, 36px)',
            lineHeight: 1.7,
            color: corpColor.white,
            fontWeight: 600,
            maxWidth: 560,
          }}
        >
          {item.body}
        </h3>
      </div>
    </div>
  );
}

export default function MVVReveal({ eyebrow, items }: { eyebrow?: string | null; items: BlockCardItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={eyebrow ?? 'Mission / Vision / Value'}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.hm-mvv-panel {
  position: relative;
  height: auto;
  min-height: 280px;
  padding: 40px 20px;
}
.hm-mvv-panel-copy { padding: 0; }
@media (min-width: 861px) {
  .hm-mvv-panel {
    position: sticky;
    top: 0;
    height: 86vh;
    min-height: 440px;
    padding: 0;
  }
  .hm-mvv-panel-copy { padding: 0 24px 64px; }
}
`,
        }}
      />
      {items.map((item, i) => (
        <Panel key={item.title + i} item={item} index={i} panelId={`mvv-${i}`} />
      ))}
    </section>
  );
}
