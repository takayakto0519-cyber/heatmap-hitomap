'use client';

import { useEffect, useState } from 'react';
import type { Trace } from '@/lib/types';

interface Props {
  traces: Trace[];
}

interface ContributorProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Contributor {
  userId: string;
  postCount: number;
  audioCount: number;
  profile: ContributorProfile | null;
}

// 語り部：この地域に一番よく記録を残している人を紹介する。認定ガイド制度への入口
export default function Storytellers({ traces }: Props) {
  const [contributors, setContributors] = useState<Contributor[]>([]);

  useEffect(() => {
    const stats = new Map<string, { postCount: number; audioCount: number }>();
    for (const t of traces) {
      if (!t.user_id) continue;
      const s = stats.get(t.user_id) ?? { postCount: 0, audioCount: 0 };
      s.postCount += 1;
      if (t.audio_url) s.audioCount += 1;
      stats.set(t.user_id, s);
    }
    const ranked = Array.from(stats.entries())
      .sort((a, b) => b[1].postCount - a[1].postCount)
      .slice(0, 5);

    if (ranked.length === 0) { setContributors([]); return; }

    let cancelled = false;
    (async () => {
      const { createAuthBrowserClient } = await import('@/lib/supabase/authClient');
      const supabase = createAuthBrowserClient();
      const ids = ranked.map(([userId]) => userId);
      const { data } = await supabase
        .from('profiles').select('id, username, display_name, avatar_url').in('id', ids);
      if (cancelled) return;
      const profileMap = new Map((data ?? []).map((p) => [p.id, p as ContributorProfile]));
      setContributors(ranked.map(([userId, s]) => ({
        userId, postCount: s.postCount, audioCount: s.audioCount,
        profile: profileMap.get(userId) ?? null,
      })));
    })();
    return () => { cancelled = true; };
  }, [traces]);

  if (contributors.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#444' }}>🎙 この地域の語り部</p>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {contributors.map((c) => {
          const label = c.profile?.display_name ?? c.profile?.username ?? '名無しの語り部';
          const cardStyle: React.CSSProperties = {
            flex: '0 0 auto', width: 132, background: '#fff', borderRadius: 12,
            border: '1px solid #eee', padding: '12px 10px', textAlign: 'center',
            textDecoration: 'none', color: 'inherit', display: 'block',
          };
          const inner = (
            <>
              {c.profile?.avatar_url ? (
                <img src={c.profile.avatar_url} alt="" style={{
                  width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 6px',
                }} />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', margin: '0 auto 6px',
                  background: '#F3EAFB', color: '#8E44AD', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>👤</div>
              )}
              <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
                📍{c.postCount}{c.audioCount > 0 ? ` ・ 🎙${c.audioCount}` : ''}
              </p>
            </>
          );
          return c.profile?.username ? (
            <a key={c.userId} href={`/profile/${c.profile.username}`} style={cardStyle}>{inner}</a>
          ) : (
            <div key={c.userId} style={cardStyle}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
