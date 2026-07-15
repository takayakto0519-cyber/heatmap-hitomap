'use client';

// 読了プログレスバー：スクロール量に応じてヘッダー下端に苔色の線が伸びる。
// ページが「読み物として設計されている」ことを示す、控えめな演出。
import { useEffect, useState } from 'react';
import { corpColor } from './tokens';

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        bottom: -1,
        height: 2,
        width: `${progress * 100}%`,
        background: corpColor.moss,
        transition: 'width 0.1s linear',
      }}
    />
  );
}
