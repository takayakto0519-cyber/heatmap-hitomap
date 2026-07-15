'use client';

// スクロール量に応じて子要素をゆっくり縦にずらすパララックス。
// ページ全体が「地図の上を移動している」感覚を作る。reduced-motionでは無効。
import { useEffect, useRef } from 'react';

export default function Parallax({ speed = 0.12, children }: { speed?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (el) el.style.transform = `translateY(${window.scrollY * speed}px)`;
      });
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
      {children}
    </div>
  );
}
