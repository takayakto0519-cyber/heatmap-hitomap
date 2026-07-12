'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { DirectMessage } from '@/lib/types';

interface OtherProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function DmThreadPage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isMutual, setIsMutual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThread = useCallback(async (otherId: string, scrollToBottom: boolean) => {
    const res = await fetch(`/api/messages/${otherId}`);
    const data = await res.json();
    if (data.ok) {
      setMessages(data.messages ?? []);
      setIsMutual(data.isMutual ?? false);
      if (scrollToBottom) setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end' }), 0);
    } else {
      setError(data.error ?? '読み込みに失敗しました');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { createAuthBrowserClient } = await import('@/lib/supabase/authClient');
        const supabase = createAuthBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('ログインが必要です'); setLoading(false); return; }
        setMyId(user.id);

        const { data: rows, error: profileError } = await supabase
          .from('profiles').select('id, username, display_name, avatar_url').eq('username', username).maybeSingle();
        if (profileError || !rows) { setError('ユーザーが見つかりません'); setLoading(false); return; }
        setOther(rows as OtherProfile);

        await loadThread(rows.id, true);
      } catch (e) {
        setError(e instanceof Error ? e.message : '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [username, loadThread]);

  // 相手からの新着メッセージに追従するため、開いている間は軽くポーリングする
  useEffect(() => {
    if (!other) return;
    const id = setInterval(() => loadThread(other.id, false), 6000);
    return () => clearInterval(id);
  }, [other, loadThread]);

  async function send() {
    const text = input.trim();
    if (!text || !other || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: other.id, body: text }),
      });
      const data = await res.json();
      if (data.ok) {
        setInput('');
        await loadThread(other.id, true);
      } else {
        setError(data.error ?? '送信に失敗しました');
      }
    } catch {
      setError('通信エラー');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>読み込み中…</div>;
  if (error && !other) return <div style={{ padding: 20, color: '#E74C3C' }}>{error}</div>;
  if (!other) return null;

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
        background: '#fff', borderBottom: '1px solid #eee', position: 'sticky', top: 0, zIndex: 5,
      }}>
        <button onClick={() => router.push('/messages')}
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4 }}>←</button>
        {other.avatar_url ? (
          <img src={other.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: '#f0f0f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>👤</div>
        )}
        <a href={`/profile/${other.username}`} style={{ textDecoration: 'none', color: '#222' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{other.display_name ?? other.username}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#999' }}>@{other.username}</p>
        </a>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', maxWidth: 600, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 40 }}>
            まだメッセージはありません。最初の一言を送ってみましょう。
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m) => {
            const mine = m.sender_id === myId;
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '9px 13px', borderRadius: 16,
                  background: mine ? '#FF6B9D' : '#fff',
                  color: mine ? '#fff' : '#222',
                  boxShadow: mine ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.body}
                  <div style={{
                    fontSize: 10, marginTop: 3, textAlign: 'right',
                    color: mine ? 'rgba(255,255,255,0.75)' : '#bbb',
                  }}>
                    {new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ color: '#E55039', fontSize: 12, textAlign: 'center', margin: '0 0 6px' }}>{error}</p>}

      {isMutual ? (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 16px', background: '#fff', borderTop: '1px solid #eee',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="メッセージを入力…"
            rows={1}
            style={{
              flex: 1, resize: 'none', padding: '10px 14px', borderRadius: 20, border: '1.5px solid #ddd',
              fontSize: 14, fontFamily: 'inherit', maxHeight: 100,
            }}
          />
          <button onClick={send} disabled={sending || !input.trim()} style={{
            padding: '0 18px', borderRadius: 20, border: 'none',
            background: input.trim() ? '#FF6B9D' : '#eee', color: input.trim() ? '#fff' : '#bbb',
            fontWeight: 700, fontSize: 14, cursor: input.trim() && !sending ? 'pointer' : 'default',
          }}>送信</button>
        </div>
      ) : (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#bbb', padding: '14px 16px', background: '#fff', borderTop: '1px solid #eee' }}>
          お互いにフォローしている場合のみメッセージを送れます
        </p>
      )}
    </div>
  );
}
