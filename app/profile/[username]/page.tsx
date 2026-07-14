'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';
import type { Trace } from '@/lib/types';
import { computeBadges } from '@/lib/badges';

const TraceMap = dynamic(() => import('@/components/map/TraceMap'), { ssr: false });

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

function Avatar({ url, size = 72 }: { url: string | null; size?: number }) {
  if (url) {
    return (
      <img src={url} alt="" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#F3EAFB', color: '#8E44AD',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800,
    }}>👤</div>
  );
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [myTraces, setMyTraces] = useState<Trace[]>([]);
  const [routeCompletionCount, setRouteCompletionCount] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ createAuthBrowserClient }] = await Promise.all([
          import('@/lib/supabase/authClient'),
        ]);
        const supabase = createAuthBrowserClient();
        let normalizedUsername = String(username);
        try { normalizedUsername = decodeURIComponent(normalizedUsername); } catch { /* already decoded */ }
        normalizedUsername = normalizedUsername.normalize('NFC').trim();
        const { data: rows, error: profileError } = await supabase
          .from('profiles').select('*').eq('username', normalizedUsername).maybeSingle();
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
        setIsMutual(followRes.isMutual ?? false);

        const tracesRes = await fetch(`/api/traces?user_id=${rows.id}&limit=500`).then(r => r.json()).catch(() => null);
        if (tracesRes?.ok) setMyTraces(tracesRes.traces ?? []);

        const routeRes = await fetch(`/api/routes/completions?user_id=${rows.id}`).then(r => r.json()).catch(() => null);
        if (routeRes?.ok) setRouteCompletionCount(routeRes.count ?? 0);
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
      if (isFollowing) {
        setIsMutual(false);
      } else {
        const followRes = await fetch(`/api/follows?user_id=${profile.id}`).then(r => r.json()).catch(() => null);
        if (followRes?.ok) setIsMutual(followRes.isMutual ?? false);
      }
    } else if (res.status === 401) {
      window.location.href = '/login';
    }
  }

  function startEdit() {
    if (!profile) return;
    setEditDisplayName(profile.display_name ?? '');
    setEditBio(profile.bio ?? '');
    setEditError('');
    setEditing(true);
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;
    setAvatarUploading(true);
    setEditError('');
    try {
      const { uploadAvatar } = await import('@/lib/supabase/upload');
      const avatarUrl = await uploadAvatar(file, profile.id);
      const res = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });
      const data = await res.json();
      if (data.ok) setProfile(data.profile as Profile);
      else setEditError(data.error ?? 'アイコンの更新に失敗しました');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'アイコンの更新に失敗しました');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setEditError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editDisplayName.trim() || null, bio: editBio.trim() || null }),
      });
      const data = await res.json();
      if (data.ok) {
        setProfile(data.profile as Profile);
        setEditing(false);
      } else {
        setEditError(data.error ?? '保存に失敗しました');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>読み込み中…</div>;
  if (error || !profile) return <div style={{ padding: 20, color: '#E74C3C' }}>{error ?? 'ユーザーが見つかりません'}</div>;

  return (
    <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
      <a href="/map" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>← マップへ戻る</a>
      <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginTop: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative' }}>
            <Avatar url={profile.avatar_url} />
            {isMe && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  title="アイコンを変更"
                  style={{
                    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%',
                    border: '2px solid #fff', background: '#38ADA9', color: '#fff', fontSize: 12,
                    cursor: avatarUploading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{avatarUploading ? '…' : '📷'}</button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} />
              </>
            )}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{profile.display_name ?? profile.username}</h1>
            <p style={{ fontSize: 13, color: '#999', margin: '2px 0 0' }}>@{profile.username}</p>
          </div>
        </div>

        {editError && <p style={{ color: '#E55039', fontSize: 12, margin: '0 0 10px' }}>{editError}</p>}

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>表示名</label>
            <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} placeholder={profile.username}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13 }} />
            <label style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>自己紹介</label>
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
              placeholder="どんな痕跡を残していきたいか、書いてみてください"
              style={{ padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveProfile} disabled={saving} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: '#38ADA9', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontSize: 13,
              }}>{saving ? '保存中…' : '保存する'}</button>
              <button onClick={() => setEditing(false)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #ddd',
                background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
              }}>キャンセル</button>
            </div>
          </div>
        ) : (
          profile.bio && <p style={{ fontSize: 13, color: '#555', marginBottom: 14 }}>{profile.bio}</p>
        )}

        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#666', marginBottom: 16 }}>
          <span><strong>{followingCount}</strong> フォロー中</span>
          <span><strong>{followersCount}</strong> フォロワー</span>
        </div>

        {(() => {
          const badges = computeBadges(myTraces, routeCompletionCount);
          if (badges.length === 0) return null;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
              {badges.map(badge => (
                <div key={badge.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#FBF6FF', border: '1px solid #F3EAFB', borderRadius: 10, padding: '8px 10px',
                }}>
                  <span style={{ fontSize: 20 }}>{badge.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#8E44AD', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{badge.label}</p>
                    <p style={{ margin: 0, fontSize: 10, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        {!isMe && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={toggleFollow} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
              background: isFollowing ? '#eee' : '#38ADA9',
              color: isFollowing ? '#666' : '#fff', fontWeight: 700, cursor: 'pointer',
            }}>{isFollowing ? 'フォロー中 ✓' : 'フォローする'}</button>
            {isMutual && (
              <a href={`/messages/${profile.username}`} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #FF6B9D',
                background: '#fff', color: '#FF6B9D', fontWeight: 700, cursor: 'pointer',
                textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box',
              }}>💬 メッセージ</a>
            )}
          </div>
        )}
        {isMe && !editing && (
          <button onClick={startEdit} style={{
            width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px solid #38ADA9',
            background: '#fff', color: '#38ADA9', fontWeight: 700, cursor: 'pointer',
          }}>✏️ プロフィールを編集</button>
        )}
      </div>

      {myTraces.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🥾 歩いた軌跡（{myTraces.length}件）</h2>
          <div style={{ height: 260, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <TraceMap traces={myTraces} mode="pin" allowWideZoom onTraceClick={setSelectedTrace} />
          </div>
        </div>
      )}

      {(() => {
        const now = new Date();
        const thisMonth = myTraces.filter(t => {
          const d = new Date(t.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });
        if (thisMonth.length === 0) return null;
        const monthRegionCount = new Set(thisMonth.map(t => t.region).filter(Boolean)).size;
        return (
          <div style={{
            marginTop: 20, background: '#fff', borderRadius: 14, padding: 16,
            boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
              📅 {now.getMonth() + 1}月の振り返り
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
              今月は<strong style={{ color: '#38ADA9' }}>{thisMonth.length}件</strong>の記録を残し、
              <strong style={{ color: '#38ADA9' }}>{monthRegionCount}</strong>の町を歩いた
            </p>
          </div>
        );
      })()}

      {(() => {
        const now = new Date();
        const onThisDay = myTraces.filter(t => {
          const d = new Date(t.created_at);
          return d.getFullYear() < now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        });
        if (onThisDay.length === 0) return null;
        return (
          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🕰 過去の今日</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {onThisDay.map(t => (
                <TraceCard key={t.id} trace={t} onClick={() => setSelectedTrace(t)} />
              ))}
            </div>
          </div>
        );
      })()}

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
          isOwn={isMe && selectedTrace.user_id === profile.id}
          onClose={() => setSelectedTrace(null)}
          onUpdate={(updated) => {
            setBookmarks(prev => prev.map(t => t.id === updated.id ? updated : t));
            setMyTraces(prev => prev.map(t => t.id === updated.id ? updated : t));
          }}
          onDelete={(id) => {
            setBookmarks(prev => prev.filter(t => t.id !== id));
            setMyTraces(prev => prev.filter(t => t.id !== id));
          }}
        />
      )}
    </div>
  );
}
