'use client';

// 見出しを一文字ずつ、筆を置くようにわずかな時間差で立ち上げる。
// 行単位のRevealより手作業の気配が出る。reduced-motionでは即時表示。
import { useEffect, useState } from 'react';

interface Props {
  lines: string[];        // 行ごとの文字列。<br>相当の改行位置を配列で渡す
  baseDelay?: number;     // 再生開始までの待ち(ms)
  charDelay?: number;     // 文字ごとの時間差(ms)
  style?: React.CSSProperties;
  as?: 'h1' | 'h2' | 'h3';
}

export default function CharReveal({ lines, baseDelay = 150, charDelay = 45, style, as = 'h1' }: Props) {
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      setShown(true);
      return;
    }
    const t = window.setTimeout(() => setShown(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  const Tag = as;
  let charIndex = 0;

  return (
    <Tag style={style} aria-label={lines.join('')}>
      {lines.map((line, li) => (
        <span key={li} style={{ display: 'block' }} aria-hidden="true">
          {Array.from(line).map((ch, ci) => {
            const delay = baseDelay + charIndex * charDelay;
            charIndex += 1;
            return (
              <span
                key={ci}
                style={{
                  display: 'inline-block',
                  opacity: shown ? 1 : 0,
                  transform: shown ? 'none' : 'translateY(0.35em)',
                  transition: reduced
                    ? 'none'
                    : `opacity 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
                }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
