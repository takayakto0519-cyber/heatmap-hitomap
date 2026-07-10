'use client';

import { useEffect } from 'react';

// PWAとしてホーム画面に追加できるようにするための最小登録（キャッシュ戦略は持たない）
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
