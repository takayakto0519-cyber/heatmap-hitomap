'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type BottomNavTab = 'map' | 'post' | 'list' | 'routes' | 'following' | 'messages';

interface Props {
  active: BottomNavTab;
  // /map ページ内で呼ばれる場合は、ページ遷移せずタブだけ切り替える
  onTabChange?: (tab: 'map' | 'post' | 'list') => void;
}

const ITEMS: { id: BottomNavTab; icon: string; label: string }[] = [
  { id: 'map', icon: '🗺', label: 'マップ' },
  { id: 'post', icon: '✚', label: '記録する' },
  { id: 'list', icon: '📋', label: '一覧' },
  { id: 'routes', icon: '🥾', label: 'ルート' },
  { id: 'following', icon: '👥', label: 'つながり' },
  { id: 'messages', icon: '💬', label: 'メッセージ' },
];

// /routes・/following はこれまで独立したページ遷移になっていて、このナビ自体を持っていなかった。
// そのため一度ルート／つながりに入ると、他のタブに戻る手段が「戻る」しかなくなっていた。
// 共通コンポーネント化し、どのページからも同じナビで行き来できるようにする。
// メッセージ機能はヘッダーの小さいアイコンにしか無く見つけにくかったため、ここにタブとして常設する。
export default function BottomNav({ active, onTabChange }: Props) {
  const router = useRouter();
  const [dmUnreadCount, setDmUnreadCount] = useState(0);

  useEffect(() => {
    fetch('/api/messages').then(r => r.json()).then(d => {
      if (d.ok) setDmUnreadCount((d.conversations ?? []).reduce((sum: number, c: { unreadCount: number }) => sum + c.unreadCount, 0));
    }).catch(() => {});
  }, []);

  function go(id: BottomNavTab) {
    if ((id === 'map' || id === 'post' || id === 'list') && onTabChange) {
      onTabChange(id);
      return;
    }
    if (id === 'routes') { router.push('/routes'); return; }
    if (id === 'following') { router.push('/following'); return; }
    if (id === 'messages') { router.push('/messages'); return; }
    router.push(`/map${id === 'map' ? '' : `?tab=${id}`}`);
  }

  return (
    <nav style={{
      display: 'flex', borderTop: '1px solid #eee',
      background: '#fff', flexShrink: 0, zIndex: 300,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {ITEMS.map(({ id, icon, label }) => (
        <button key={id} onClick={() => go(id)} style={{
          flex: 1, padding: '10px 4px 8px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          color: active === id ? '#FF6B9D' : '#999', fontWeight: active === id ? 700 : 400,
          borderTop: `2.5px solid ${active === id ? '#FF6B9D' : 'transparent'}`,
          transition: 'color 0.15s',
        }}>
          <span style={{ position: 'relative', fontSize: id === 'post' ? 22 : 20 }}>
            {icon}
            {id === 'messages' && dmUnreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -8, minWidth: 14, height: 14, borderRadius: 7,
                background: '#E55039', color: '#fff', fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>{dmUnreadCount > 9 ? '9+' : dmUnreadCount}</span>
            )}
          </span>
          <span style={{ fontSize: 11 }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
