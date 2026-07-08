'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';
import type { Trace } from '@/lib/types';

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ createAuthBrowserClient }] = await Promise.all([
          import('@/lib/supabase/authClient'),
        ]);
        const supabase = createAuthBrowserClient();
        const { data: rows, error: profileError } = await supabase
          .from('profiles').select('*').eq('username', username).maybeSingle();
        if (profileError || !rows) {
          setError('ユーザーが見つかりません');
          setLoading(false);
          return;
        }
        setProfile(rows as Profile);

        const { data: { user } } = await supabase.auth.getUser();
        const me = user?.id === rows.id;
        setIsMe(me);
        if (me) {
          const bmRes = await fetch('/api/bookmarks').then(r => r.json()).catch(() => null);
          if (bmRes?.ok) setBookmarks(bmRes.traces ?? []);
        }

        const followRes = await fetch(`/api/follows?user_id=${rows.id}`).then(r => r.json());
        setFollowingCount(followRes.followingCount ?? 0);
        setFollowersCount(followRes.followersCount ?? 0);
        setIsFollowing(followRes.isFollowing ?? false);
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  async function toggleFollow() {
    if (!profile) return;
    const method = isFollowing ? 'DELETE' : 'POST';
    const res = await fetch('/api/follows', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followee_id: profile.id }),
    });
    const data = await res.json();
    if (data.ok) {
      setIsFollowing(!isFollowing);
      setFollowersCount(c => c + (isFollowing ? -1 : 1));
    } else if (res.status === 401) {
      window.location.href = '/login';
    }
  }

  if (loading) return <div style={{ padding: 20 }}>読み込み中…</div>;
  if (error || !profile) return <div style={{ padding: 20, color: '#E74C3C' }}>{error ?? 'ユーザーが見つかりません'}</div>;

  return (
    <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
      <a href="/map" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>← マップへ戻る</a>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginTop: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{profile.display_name ?? profile.username}</h1>
        <p style={{ fontSize: 13, color: '#999', marginBottom: 10 }}>@{profile.username}</p>
        {profile.bio && <p style={{ fontSize: 13, color: '#555', marginBottom: 14 }}>{profile.bio}</p>}
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#666', marginBottom: 16 }}>
          <span><strong>{followingCount}</strong> フォロー中</span>
          <span><strong>{followersCount}</strong> フォロワー</span>
        </div>
        {!isMe && (
          <button onClick={toggleFollow} style={{
            width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
            background: isFollowing ? '#eee' : '#38ADA9',
            color: isFollowing ? '#666' : '#fff', fontWeight: 700, cursor: 'pointer',
          }}>{isFollowing ? 'フォロー中 ✓' : 'フォローする'}</button>
        )}
      </div>

      {isMe && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🔖 保存した記録（{bookmarks.length}）</h2>
          {bookmarks.length === 0 ? (
            <p style={{ fontSize: 13, color: '#aaa' }}>まだ保存した記録はありません</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookmarks.map(t => (
                <TraceCard key={t.id} trace={t} onClick={() => setSelectedTrace(t)} />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTrace && (
        <TraceDetail
          trace={selectedTrace}
          isOwn={false}
          onClose={() => setSelectedTrace(null)}
          onUpdate={(updated) => setBookmarks(prev => prev.map(t => t.id === updated.id ? updated : t))}
          onDelete={(id) => setBookmarks(prev => prev.filter(t => t.id !== id))}
        />
      )}
    </div>
  );
}
