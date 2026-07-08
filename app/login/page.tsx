'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthBrowserClient } from '@/lib/supabase/authClient';

// SupabaseのAuthErrorはmessageが空のことがあり、その場合 String(err) が "{}" になって
// そのままユーザーに見せてしまうバグがあった。空・非文字列のケースをフォールバックする。
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null) {
    const withMessage = err as { message?: unknown; error_description?: unknown };
    if (typeof withMessage.message === 'string' && withMessage.message) return withMessage.message;
    if (typeof withMessage.error_description === 'string' && withMessage.error_description) return withMessage.error_description;
  }
  return 'メール送信に失敗しました。時間をおいて再度お試しください。';
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const supabase = createAuthBrowserClient();
    try {
      if (mode === 'signup') {
        if (!username.trim()) {
          setError('ユーザー名を入力してください');
          setBusy(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.user) {
          await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.trim() }),
          });
        }
        if (data.session) {
          // メール確認が不要な設定の場合、signUp直後にセッションが発行される。その場合は確認メール待ちにせずそのまま入る。
          router.push('/map');
          router.refresh();
          return;
        }
        setMessage('確認メールを送りました。メール内のリンクからログインを完了してください。');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push('/map');
        router.refresh();
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 20, background: '#fafafa',
    }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>ヒトマップ</h1>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 18 }}>
          アカウントを作ると、投稿の公開範囲（非公開・フォロワー限定・全国公開）を選べます。
        </p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <button onClick={() => setMode('signin')} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            border: `1.5px solid ${mode === 'signin' ? '#38ADA9' : '#ddd'}`,
            background: mode === 'signin' ? '#E8F8F7' : '#fff',
            color: mode === 'signin' ? '#38ADA9' : '#666', fontWeight: 700,
          }}>ログイン</button>
          <button onClick={() => setMode('signup')} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            border: `1.5px solid ${mode === 'signup' ? '#38ADA9' : '#ddd'}`,
            background: mode === 'signup' ? '#E8F8F7' : '#fff',
            color: mode === 'signup' ? '#38ADA9' : '#666', fontWeight: 700,
          }}>新規登録</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'signup' && (
            <input
              type="text" placeholder="ユーザー名" value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
              required
            />
          )}
          <input
            type="email" placeholder="メールアドレス" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
            required
          />
          <input
            type="password" placeholder="パスワード（6文字以上）" value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
            required
          />

          {error && <p style={{ fontSize: 12, color: '#E74C3C', margin: 0 }}>{error}</p>}
          {message && <p style={{ fontSize: 12, color: '#27AE60', margin: 0 }}>{message}</p>}

          <button type="submit" disabled={busy} style={{
            padding: '11px 0', borderRadius: 10, border: 'none', marginTop: 4,
            background: busy ? '#ccc' : 'linear-gradient(135deg, #FF6B9D, #FF9068)',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer',
          }}>
            {busy ? '処理中…' : mode === 'signup' ? '登録する' : 'ログイン'}
          </button>
        </form>

        <button onClick={() => router.push('/map')} style={{
          marginTop: 14, background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer',
        }}>
          ← ログインせずにマップへ戻る
        </button>
      </div>
    </div>
  );
}
