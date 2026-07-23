'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'hitomap_onboarded_v1';

interface Slide {
  emoji: string;
  title: string;
  body: string;
  logo?: boolean;
}

const SLIDES: Slide[] = [
  {
    emoji: '🗺️',
    logo: true,
    title: 'ヒトマップ',
    body: '言葉は繕える。\nしかし、モノに残った痕跡は、そのままの姿をしている。',
  },
  {
    emoji: '👣',
    title: '痕跡を記録する',
    body: '町を歩いて見つけた、\n誰かの生きた証を残す。\n修理された椅子、色あせた看板——\nそこに積もった時間を記録する。',
  },
  {
    emoji: '🔥',
    title: 'ヒートマップになる',
    body: '記録が集まるほど、\nその町の想いが色濃く浮かび上がる。\nさあ、最初の一つを見つけに行こう。',
  },
];

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorageが使えない環境ではオンボーディングを出さない
    }
  }, []);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // 無視
    }
    setVisible(false);
  }

  if (!visible) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483647,
        background: 'linear-gradient(160deg, #3B4530, #566246)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, color: '#fff', textAlign: 'center',
      }}
      onClick={() => { if (!isLast) setStep((s) => s + 1); }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); finish(); }}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: 20,
          color: '#fff', fontSize: 13, padding: '6px 14px', cursor: 'pointer',
        }}
      >
        スキップ
      </button>

      {slide.logo ? (
        <img src="/logo.png" alt="ヒトマップ" style={{ height: 88, width: 'auto', marginBottom: 24 }} />
      ) : (
        <div style={{ fontSize: 64, marginBottom: 20, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}>{slide.emoji}</div>
      )}
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 16px', textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>{slide.title}</h1>
      <p style={{ fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-line', margin: '0 0 40px', textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        {slide.body}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 20 : 8, height: 8, borderRadius: 4,
            background: i === step ? '#fff' : 'rgba(255,255,255,0.5)',
            transition: 'width 0.2s',
          }} />
        ))}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); isLast ? finish() : setStep((s) => s + 1); }}
        style={{
          width: '100%', maxWidth: 280, padding: '14px', borderRadius: 12, border: 'none',
          background: '#fff', color: '#3B4530', fontWeight: 800, fontSize: 15, cursor: 'pointer',
        }}
      >
        {isLast ? 'はじめる →' : '次へ'}
      </button>
    </div>
  );
}
