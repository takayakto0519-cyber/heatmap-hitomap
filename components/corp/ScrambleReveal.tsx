'use client';

// locomotive.ca 等に見られる「ノイズ→単語への収束」演出。
// CharRevealの一文字フェードより、痕跡＝最初は判読できない断片が意味を持って立ち上がる、
// というhitomapの世界観に合うため、Heroの見出し専用に用意する。
// 句読点・空白はスクランブルせずそのまま出す（読みにくくなるだけで痕跡感が出ないため）。
import { useEffect, useRef, useState } from 'react';

interface Props {
  lines: string[];        // 行ごとの文字列。<br>相当の改行位置を配列で渡す
  baseDelay?: number;     // 再生開始までの待ち(ms)
  charDelay?: number;     // 文字ごとの時間差(ms)
  style?: React.CSSProperties;
  as?: 'h1' | 'h2' | 'h3';
}

// スクランブル中に出す文字（記号＋断片感のある漢字1文字）。実際の見出し文字と一致しても違和感はない
const NOISE_POOL = '#*+%&?□△◇○●∴∵§¶†‡道跡影光音場記憶残歩見色時'.split('');
const SCRAMBLE_MS = 380; // 1文字が収束するまでの時間
const TICK_MS = 45;      // 表示を切り替える間隔

function isSkippable(ch: string): boolean {
  return /[\s、。！？!?「」『』・—―\-,.]/.test(ch);
}

function randomNoiseChar(): string {
  return NOISE_POOL[Math.floor(Math.random() * NOISE_POOL.length)];
}

export default function ScrambleReveal({ lines, baseDelay = 200, charDelay = 55, style, as = 'h1' }: Props) {
  const [reduced, setReduced] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      return;
    }
    startRef.current = Date.now();
    const totalChars = lines.reduce((n, l) => n + l.length, 0);
    const totalDuration = baseDelay + totalChars * charDelay + SCRAMBLE_MS + 80;
    const id = window.setInterval(() => {
      const e = Date.now() - startRef.current;
      setElapsed(e);
      if (e >= totalDuration) window.clearInterval(id);
    }, TICK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

            if (reduced || isSkippable(ch)) {
              return <span key={ci} style={{ display: 'inline-block' }}>{ch}</span>;
            }

            const started = elapsed >= delay;
            const settled = elapsed >= delay + SCRAMBLE_MS;
            const shown = started ? (settled ? ch : randomNoiseChar()) : ' ';

            return (
              <span
                key={ci}
                style={{
                  display: 'inline-block',
                  minWidth: '0.55em',
                  opacity: started ? 1 : 0,
                  transition: 'opacity 0.25s ease',
                }}
              >
                {shown}
              </span>
            );
          })}
        </span>
      ))}
    </Tag>
  );
}
