'use client';

import { useEffect, useRef, useState } from 'react';

// SANU（sa-nu.com）のスクロール演出を踏襲：
// セクションが視界に入った瞬間、下から静かに立ち上がる（opacity + translateY）。
// prefers-reduced-motion の環境では演出を無効化し、即時表示する。
interface Props {
  children: React.ReactNode;
  delay?: number;      // ms。カードの時間差表示（stagger）に使う
  immediate?: boolean; // true = スクロールを待たずマウント直後に再生（ヒーロー用）
  y?: number;          // 立ち上がり距離(px)
  style?: React.CSSProperties; // 呼び出し側でgrid-column等をこの要素自体に効かせたい場合に使う
}

export default function Reveal({ children, delay = 0, immediate = false, y = 28, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    if (immediate) {
      // マウント直後の1フレーム後に再生（transitionを効かせるため）
      const t = window.setTimeout(() => setShown(true), 30 + delay);
      return () => window.clearTimeout(t);
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          window.setTimeout(() => setShown(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, immediate]);

  return (
    <div
      ref={ref}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? (style?.transform ?? 'none') : `translateY(${y}px)`,
        transition: 'opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1), transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: shown ? undefined : 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
