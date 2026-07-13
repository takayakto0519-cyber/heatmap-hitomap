'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthBrowserClient } from '@/lib/supabase/authClient';

// SupabaseのAuthErrorはmessageが空、または"{}"という無意味な文字列になることがあり、
// そのままユーザーに見せてしまうバグがあった。空・非文字列・"{}"のケースをフォールバックする。
function isUsableMessage(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.trim() !== '{}';
}
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && isUsableMessage(err.message)) return err.message;
  if (typeof err === 'object' && err !== null) {
    const withMessage = err as { message?: unknown; error_description?: unknown; msg?: unknown };
    if (isUsableMessage(withMessage.message)) return withMessage.message;
    if (isUsableMessage(withMessage.error_description)) return withMessage.error_description;
    if (isUsableMessage(withMessage.msg)) return withMessage.msg;
  }
  return 'メール送信に失敗しました。時間をおいて再度お試しください。';
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setMessage(null);
    setBusy(true);
    const supabase = createAuthBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/map` },
    });
    if (oauthError) {
      setError(extractErrorMessage(oauthError));
      setBusy(false);
    }
    // 成功時はGoogleの認証画面へ遷移するため、ここでのbusy解除は不要。
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const supabase = createAuthBrowserClient();
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (resetError) throw resetError;
      setMessage('パスワード再設定用のメールを送りました（届かない場合は下記の問い合わせ先までご連絡ください）。');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

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
        // メール確認が必須の設定では、signUp直後はまだセッションが無く（＝ログイン状態ではなく）、
        // ここで/api/profileを呼んでも401で弾かれてユーザー名が保存されないまま消えてしまう。
        // そのため、希望のユーザー名はuser_metadataに載せておき、メール確認後の初回ログイン時に
        // プロフィールが無ければそこから自動作成する（/api/profileのGET側で処理）。
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/map`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          // メール確認が不要な設定の場合、signUp直後にセッションが発行される。その場合は確認メール待ちにせずそのまま入る。
          if (data.user) {
            await fetch('/api/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: username.trim() }),
            });
          }
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
        <img src="/logo.png" alt="ヒトマップ" style={{ height: 48, marginBottom: 14 }} />
        <p style={{ fontSize: 12, color: '#999', marginBottom: 18 }}>
          アカウントを作ると、投稿の公開範囲（非公開・フォロワー限定・全国公開）を選べます。
        </p>

        {mode !== 'forgot' && (
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
        )}

        {mode === 'forgot' ? (
          <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: '#999', margin: '0 0 4px' }}>
              登録したメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>
            <input
              type="email" placeholder="メールアドレス" value={email}
              onChange={e => setEmail(e.target.value)}
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
              {busy ? '送信中…' : '再設定メールを送る'}
            </button>
            <button type="button" onClick={() => { setMode('signin'); setError(null); setMessage(null); }} style={{
              background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer', padding: 0,
            }}>← ログインへ戻る</button>
          </form>
        ) : (
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

            {mode === 'signin' && (
              <button type="button" onClick={() => { setMode('forgot'); setError(null); setMessage(null); }} style={{
                alignSelf: 'flex-end', background: 'none', border: 'none', color: '#38ADA9', fontSize: 12, cursor: 'pointer', padding: 0,
              }}>パスワードをお忘れですか？</button>
            )}

            {error && <p style={{ fontSize: 12, color: '#E74C3C', margin: 0 }}>{error}</p>}
            {message && <p style={{ fontSize: 12, color: '#27AE60', margin: 0 }}>{message}</p>}

            {mode === 'signup' && (
              <p style={{ fontSize: 11, color: '#aaa', margin: 0, lineHeight: 1.6 }}>
                登録すると<a href="/terms" target="_blank" style={{ color: '#38ADA9' }}>利用規約</a>・
                <a href="/privacy" target="_blank" style={{ color: '#38ADA9' }}>プライバシーポリシー</a>に同意したものとみなされます。
              </p>
            )}

            <button type="submit" disabled={busy} style={{
              padding: '11px 0', borderRadius: 10, border: 'none', marginTop: 4,
              background: busy ? '#ccc' : 'linear-gradient(135deg, #FF6B9D, #FF9068)',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer',
            }}>
              {busy ? '処理中…' : mode === 'signup' ? '登録する' : 'ログイン'}
            </button>
          </form>
        )}

        {mode !== 'forgot' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: '#eee' }} />
              <span style={{ fontSize: 11, color: '#bbb' }}>または</span>
              <div style={{ flex: 1, height: 1, background: '#eee' }} />
            </div>
            <button type="button" onClick={handleGoogleSignIn} disabled={busy} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '11px 0', borderRadius: 10,
              border: '1.5px solid #ddd', background: '#fff', color: '#333',
              fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer',
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
              </svg>
              {mode === 'signup' ? 'Googleで登録' : 'Googleでログイン'}
            </button>
          </>
        )}

        <button onClick={() => router.push('/map')} style={{
          marginTop: 14, background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer',
        }}>
          ← ログインせずにマップへ戻る
        </button>

        <p style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f0f0', fontSize: 11, color: '#bbb', textAlign: 'center' }}>
          お困りの際は <a href="mailto:hitomap.info@gmail.com" style={{ color: '#999' }}>hitomap.info@gmail.com</a> までご連絡ください
        </p>
      </div>
    </div>
  );
}
