'use client';

// SANU等の「写真グリッド＋スクロールでごくわずかな速度差」を踏襲した、グリッド1タイル用の視差。
// Parallax.tsx は絶対配置で全面に敷く用途（Hero背景等）のため、通常のグリッドフローの中に置ける
// この専用コンポーネントを別に用意する。動きは画面中央からの距離に比例し、上限(max)で頭打ちにする
// ことで、タイル同士が重ならない範囲に収める。reduced-motionでは無効。
import { useEffect, useRef } from 'react';

interface Props {
  speed?: number; // 大きいほど大きく動く
  max?: number;   // 動きの上限(px)
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export default function ParallaxItem({ speed = 0.05, max = 10, children, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        const offset = Math.max(-max, Math.min(max, -center * speed));
        el.style.transform = `translateY(${offset.toFixed(1)}px)`;
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed, max]);

  return (
    <div ref={ref} style={{ height: '100%', willChange: 'transform', ...style }}>
      {children}
    </div>
  );
}
