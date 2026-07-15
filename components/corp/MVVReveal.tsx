'use client';

// MVV演出「案B：全幅フォトエッセイ方式」（IKEUCHI ORGANIC / Aesop 参考）。
// position:sticky を項目数ぶん積み重ねるだけで、後続パネルが前のパネルの上に
// スクロールでせり出してくる「受け渡し」演出になる（JSでのスクロール計算は不要）。
// 背景はHeroと同じMapArt（地図アート）の別区画バリエーションを使い、
// 「同じ町の、違う場所」という一貫した世界観を保つ。
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
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const tints = [corpColor.mossDeep, corpColor.ink, corpColor.moss] as const;

  return (
    <div
      ref={ref}
      style={{
        position: 'sticky',
        top: 0,
        height: '86vh',
        minHeight: 440,
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
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 720,
          margin: '0 auto',
          padding: '0 24px 64px',
          width: '100%',
          opacity: shown ? 1 : 0,
          transform: shown ? 'none' : 'translateY(24px)',
          transition: 'opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <p
          style={{
            margin: '0 0 14px',
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
            fontSize: 'clamp(24px, 4vw, 36px)',
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
      {items.map((item, i) => (
        <Panel key={item.title + i} item={item} index={i} panelId={`mvv-${i}`} />
      ))}
    </section>
  );
}
