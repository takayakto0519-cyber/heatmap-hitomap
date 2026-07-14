'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DmConversation } from '@/lib/types';
import BottomNav from '@/components/BottomNav';

function Avatar({ url, size = 48 }: { url: string | null; size?: number }) {
  if (url) {
    return (
      <img src={url} alt="" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#f0f0f0', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4,
    }}>👤</div>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(iso).toLocaleDateString('ja-JP');
}

export default function MessagesInboxPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/messages')
      .then((r) => {
        if (r.status === 401) { setNeedsLogin(true); return null; }
        return r.json();
      })
      .then((d) => { if (d?.ok) setConversations(d.conversations ?? []); else if (d) setError(d.error ?? '読み込みに失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 40px', flex: 1, width: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => router.push('/map')}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4 }}>
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: 20 }}>💬 メッセージ</h1>
        </div>

        {loading && <p style={{ color: '#999', fontSize: 14, textAlign: 'center', padding: 40 }}>読み込み中…</p>}

        {needsLogin && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>メッセージを見るには、ログインが必要です</p>
            <button onClick={() => router.push('/login')} style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: '#FF6B9D', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>ログインする</button>
          </div>
        )}

        {error && <p style={{ color: '#E55039', fontSize: 13, textAlign: 'center' }}>{error}</p>}

        {!loading && !needsLogin && !error && conversations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <p style={{ fontSize: 14, color: '#999', marginBottom: 8 }}>まだメッセージのやり取りはありません</p>
            <p style={{ fontSize: 12, color: '#bbb' }}>
              お互いにフォローしている相手のプロフィールから「💬 メッセージ」を送れます
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {conversations.map((c) => (
            <button key={c.userId} onClick={() => router.push(`/messages/${c.username}`)} style={{
              display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left',
              background: c.unreadCount > 0 ? '#fff' : 'transparent', border: 'none', cursor: 'pointer',
              padding: '12px 10px', borderRadius: 12,
            }}>
              <Avatar url={c.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: c.unreadCount > 0 ? 800 : 700, color: '#222' }}>
                  {c.displayName ?? c.username}
                </p>
                <p style={{
                  margin: '2px 0 0', fontSize: 12.5, color: c.unreadCount > 0 ? '#333' : '#999',
                  fontWeight: c.unreadCount > 0 ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.lastSenderId !== c.userId ? 'あなた: ' : ''}{c.lastMessage}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: '#bbb' }}>{timeAgo(c.lastMessageAt)}</span>
                {c.unreadCount > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, background: '#FF6B9D', color: '#fff',
                    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                  }}>{c.unreadCount > 9 ? '9+' : c.unreadCount}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
      <BottomNav active="messages" />
    </div>
  );
}
