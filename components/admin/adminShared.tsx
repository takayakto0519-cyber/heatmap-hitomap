'use client';

// 運営ダッシュボードの複数タブで共有するプリミティブ・型・フック。
// monolith分割（app/admin/dashboard/page.tsx の薄型化）で切り出し。
import { useEffect, useState } from 'react';
import type { Trace } from '@/lib/types';
import { getEmotion } from '@/lib/emotions';
import { getCategory } from '@/lib/categories';

export const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
};
export interface AdminUserRecentTrace {
  id: string;
  title: string;
  photo_url: string | null;
  emotion_key: string | null;
  visibility: string;
  why: string | null;
  interpretation: string | null;
  self_reflection: string | null;
  region: string | null;
  category: string | null;
  created_at: string;
}
export interface AdminUser {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  traceCount: number;
  lastPostedAt: string | null;
  followerCount: number;
  followingCount: number;
  recentTraces: AdminUserRecentTrace[];
  auto_approve: boolean;
}
export const VISIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  public: { label: '🌏 全国公開', color: '#38ADA9' },
  followers: { label: '👥 フォロワー限定', color: '#4A69BD' },
  private: { label: '🔒 非公開', color: '#999' },
  pending_review: { label: '⏳ 審査待ち', color: '#E5A139' },
};
export function useAuthorMap(authHeaders: () => HeadersInit) {
  const [authorMap, setAuthorMap] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  useEffect(() => {
    fetch('/api/admin/profiles', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return;
        const map: Record<string, { username: string; avatar_url: string | null }> = {};
        for (const u of d.users as AdminUser[]) map[u.id] = { username: u.username, avatar_url: u.avatar_url };
        setAuthorMap(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return authorMap;
}
export function AuthorLine({ trace, authorMap }: { trace: Trace; authorMap: Record<string, { username: string; avatar_url: string | null }> }) {
  if (trace.user_id) {
    const author = authorMap[trace.user_id];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt="" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
        ) : '👤'}
        {author ? `@${author.username}` : 'ログインユーザー'}
      </span>
    );
  }
  return <span>🕶 {trace.nickname ?? '匿名'}</span>;
}
export function ContentTags({ trace }: { trace: Trace }) {
  const emotion = getEmotion(trace.emotion_key);
  const category = getCategory(trace.category);
  if (!emotion && !category && !trace.video_url) return null;
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '4px 0' }}>
      {emotion && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: emotion.color + '22', color: emotion.color, fontSize: 11, fontWeight: 700 }}>
          {emotion.emoji} {emotion.label}
        </span>
      )}
      {category && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: '#f0f0f0', color: '#666', fontSize: 11 }}>
          {category.emoji} {category.label}
        </span>
      )}
      {trace.video_url && (
        <span style={{ padding: '2px 8px', borderRadius: 20, background: '#EEF4FF', color: '#4A90E2', fontSize: 11, fontWeight: 700 }}>🎥 動画</span>
      )}
    </div>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', ...style }}>
      {children}
    </div>
  );
}
