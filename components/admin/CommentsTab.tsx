'use client';

// コメント管理：コメントの確認・削除。page.tsx monolith分割で切り出し。
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/admin/adminShared';

export interface AdminComment {
  id: string;
  created_at: string;
  trace_id: string;
  body: string;
  is_deleted: boolean;
  trace_title: string | null;
  trace_deleted: boolean;
  username: string | null;
}

export default function CommentsTab({ authHeaders }: { authHeaders: () => HeadersInit }) {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/comments', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.ok) setComments(d.comments); else setError(d.error ?? '取得に失敗しました'); })
      .catch(() => setError('通信エラー'))
      .finally(() => setLoading(false));
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm('このコメントを削除しますか？')) return;
    const res = await fetch(`/api/admin/comments/${id}`, { method: 'DELETE', headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setComments(prev => prev.map(c => c.id === id ? { ...c, is_deleted: true } : c));
    else setError(data.error ?? '削除に失敗しました');
  }

  return (
    <div>
      {error && <p style={{ color: '#E74C3C', fontSize: 13 }}>{error}</p>}
      {loading ? <p style={{ color: '#999' }}>読み込み中…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {comments.length === 0 && <p style={{ color: '#aaa' }}>まだコメントはありません。</p>}
          {comments.map(c => (
            <Card key={c.id} style={c.is_deleted ? { opacity: 0.5 } : undefined}>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#999' }}>
                <a href={`/t/${c.trace_id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38ADA9' }}>
                  {c.trace_title ?? '（投稿が見つかりません）'}
                </a>
                {c.trace_deleted && <span style={{ color: '#aaa' }}> ・ 投稿は削除済み</span>}
                {' '}・ {c.username ? `@${c.username}` : 'ユーザー不明'}
              </p>
              <p style={{ margin: '0 0 6px', fontSize: 14, color: '#333', whiteSpace: 'pre-wrap' }}>{c.body}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#bbb' }}>
                {new Date(c.created_at).toLocaleString('ja-JP')}
                {c.is_deleted && ' ・ 削除済み'}
              </p>
              {!c.is_deleted && (
                <button onClick={() => remove(c.id)} style={{
                  marginTop: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid #ddd',
                  background: '#fff', color: '#E55039', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}>削除</button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

