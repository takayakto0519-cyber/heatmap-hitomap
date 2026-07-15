'use client';

// 実数の証明バンド：DBにある本当の数字（公開投稿数・歩かれた町の数）だけを、
// 視界に入った瞬間に0からカウントアップして見せる（中川政七商店の「300余年」の数字扱いを参考）。
// 数字が取れない・0のときはバンドごと消す（空の飾りを残さない）。
import { useEffect, useRef, useState } from 'react';
import { corpColor, corpFont } from './tokens';

function CountUp({ value, started }: { value: number; started: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!started) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const duration = 1100;
    const startAt = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, started]);

  return <>{display.toLocaleString('ja-JP')}</>;
}

export default function ProofBand() {
  const [stats, setStats] = useState<{ traces: number; regions: number } | null>(null);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/stats/public')
      .then(r => r.json())
      .then(d => { if (d.ok && d.traces > 0) setStats({ traces: d.traces, regions: d.regions }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stats) return;
    const observer = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) { setStarted(true); observer.disconnect(); } },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stats]);

  if (!stats) return null;

  const items = [
    { value: stats.traces, label: '地図に残された痕跡' },
    ...(stats.regions > 0 ? [{ value: stats.regions, label: '歩かれた町' }] : []),
  ];

  return (
    <div
      ref={ref}
      style={{
        background: corpColor.white,
        borderBottom: `1px solid ${corpColor.line}`,
        padding: '36px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px 64px',
          alignItems: 'baseline',
        }}
      >
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              style={{
                fontFamily: corpFont.mincho,
                fontSize: 'clamp(34px, 5vw, 48px)',
                fontWeight: 700,
                color: corpColor.ink,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <CountUp value={item.value} started={started} />
            </span>
            <span style={{ fontSize: 12.5, color: corpColor.inkSoft, fontFamily: corpFont.body, fontWeight: 600 }}>
              {item.label}
            </span>
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 11, color: corpColor.inkSoft, fontFamily: corpFont.body, opacity: 0.75 }}>
          いま公開されている記録の実数です。
        </p>
      </div>
    </div>
  );
}
