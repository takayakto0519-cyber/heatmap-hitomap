'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TraceCard from '@/components/report/TraceCard';
import TraceDetail from '@/components/TraceDetail';
import type { Trace } from '@/lib/types';

interface FeedProfile {
  id: string;
  username: string;
  display_name: string | null;
}

interface Suggestion {
  id: string;
  username: string;
  display_name: string | null;
  followersCount: number;
}

export default function FollowingFeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [profiles, setProfiles] = useState<Record<string, FeedProfile>>({});
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/follows/feed');
        if (res.status === 401) { setNeedsLogin(true); setLoading(false); return; }
        const data = await res.json();
        if (!data.ok) { setError(data.error ?? '読み込みに失敗しました'); setLoading(false); return; }
        setTraces(data.traces ?? []);
        const map: Record<string, FeedProfile> = {};
        for (const p of (data.profiles ?? []) as FeedProfile[]) map[p.id] = p;
        setProfiles(map);

        const sugRes = await fetch('/api/follows/suggestions').then((r) => r.json()).catch(() => null);
        if (sugRes?.ok) setSuggestions(sugRes.suggestions ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function followSuggested(id: string) {
    const res = await fetch('/api/follows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followee_id: id }),
    });
    const data = await res.json();
    if (data.ok) setFollowedIds((prev) => new Set(prev).add(id));
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => router.push('/map')}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4 }}>
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: 20 }}>👥 つながり</h1>
        </div>

        {loading && <p style={{ color: '#999', fontSize: 14, textAlign: 'center', padding: 40 }}>読み込み中…</p>}

        {needsLogin && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
              フォローしている人の記録を見るには、ログインが必要です
            </p>
            <button onClick={() => router.push('/login')} style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: '#FF6B9D', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>ログインする</button>
          </div>
        )}

        {error && <p style={{ color: '#E55039', fontSize: 13, textAlign: 'center' }}>{error}</p>}

        {!loading && !needsLogin && suggestions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: '#444' }}>✨ おすすめの人</h2>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {suggestions.map((s) => {
                const followed = followedIds.has(s.id);
                return (
                  <div key={s.id} style={{
                    flexShrink: 0, width: 140, background: '#fff', borderRadius: 12,
                    padding: '12px 10px', border: '1px solid #eee', textAlign: 'center',
                  }}>
                    <a href={`/profile/${s.username}`} style={{ textDecoration: 'none', color: '#333' }}>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.display_name ?? s.username}
                      </p>
                      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#999' }}>@{s.username} ・ {s.followersCount}人</p>
                    </a>
                    <button onClick={() => followSuggested(s.id)} disabled={followed} style={{
                      width: '100%', padding: '6px 0', borderRadius: 8, border: 'none', fontSize: 12,
                      background: followed ? '#eee' : '#38ADA9', color: followed ? '#999' : '#fff',
                      fontWeight: 700, cursor: followed ? 'default' : 'pointer',
                    }}>{followed ? 'フォロー中 ✓' : 'フォローする'}</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !needsLogin && !error && traces.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <p style={{ fontSize: 14, color: '#999', marginBottom: 8 }}>
              まだ誰もフォローしていません
            </p>
            <p style={{ fontSize: 12, color: '#bbb' }}>
              気になる人をフォローすると、ここに歩みが流れてきます
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {traces.map((t) => {
            const author = t.user_id ? profiles[t.user_id] : null;
            return (
              <div key={t.id}>
                {author && (
                  <a href={`/profile/${author.username}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, color: '#666', textDecoration: 'none', marginBottom: 6,
                  }}>
                    👤 <strong>{author.display_name ?? author.username}</strong>
                  </a>
                )}
                <TraceCard trace={t} onClick={() => setSelectedTrace(t)} />
              </div>
            );
          })}
        </div>
      </div>

      {selectedTrace && (
        <TraceDetail
          trace={selectedTrace}
          isOwn={false}
          onClose={() => setSelectedTrace(null)}
          onUpdate={(updated) => setTraces((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
          onDelete={(id) => setTraces((prev) => prev.filter((t) => t.id !== id))}
        />
      )}
    </div>
  );
}
