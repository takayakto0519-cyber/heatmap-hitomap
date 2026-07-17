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

// 登録の心理的ハードルを下げるため、入口を「Google1タップ」「メールにリンクを送るだけ」の2つに絞り、
// パスワード方式は折りたたみの中に残す。ユーザー名は後から決められる（無ければ自動発行される）ため
// 登録時には聞かない。
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // パスワード方式（従来）の折りたたみ
  const [pwOpen, setPwOpen] = useState(false);
  const [pwMode, setPwMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [pwEmail, setPwEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

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

  // メールにログインリンクを送る（マジックリンク）。新規・既存どちらもこれ一本で入れる。
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const supabase = createAuthBrowserClient();
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/map`,
        },
      });
      if (otpError) throw otpError;
      setMessage('ログイン用のリンクをメールに送りました。メールを開いてリンクをタップしてください。');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const supabase = createAuthBrowserClient();
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(pwEmail, {
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

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const supabase = createAuthBrowserClient();
    try {
      if (pwMode === 'signup') {
        // ユーザー名は任意。空ならメール確認後の初回ログイン時に自動発行され、あとからマップで変更できる。
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: pwEmail,
          password,
          options: {
            data: username.trim() ? { username: username.trim() } : undefined,
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/map`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          // メール確認が不要な設定の場合、signUp直後にセッションが発行される。その場合は確認メール待ちにせずそのまま入る。
          if (data.user && username.trim()) {
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
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: pwEmail, password });
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

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 16,
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 20, background: '#fafafa',
    }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <img src="/logo.png" alt="ヒトマップ" style={{ height: 48, marginBottom: 14 }} />
        <p style={{ fontSize: 13, color: '#666', marginBottom: 18, lineHeight: 1.7 }}>
          パスワードは要りません。<br />Googleかメールアドレスだけで始められます。
        </p>

        {/* ① Googleで1タップ（いちばん気軽な入口） */}
        <button type="button" onClick={handleGoogleSignIn} disabled={busy} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '13px 0', borderRadius: 10,
          border: '1.5px solid #ddd', background: '#fff', color: '#333',
          fontWeight: 700, fontSize: 15, cursor: busy ? 'default' : 'pointer',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
          </svg>
          Googleで始める
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 14px' }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 11, color: '#bbb' }}>または</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        {/* ② メールにログインリンクを送る（新規・既存共通） */}
        <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email" placeholder="メールアドレス" value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            required
          />
          <button type="submit" disabled={busy} style={{
            padding: '12px 0', borderRadius: 10, border: 'none',
            background: busy ? '#ccc' : 'linear-gradient(135deg, #FF6B9D, #FF9068)',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer',
          }}>
            {busy ? '送信中…' : 'ログイン用リンクをメールで受け取る'}
          </button>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0, lineHeight: 1.6 }}>
            初めての方はこれだけで登録できます。ユーザー名はあとから決められます。
            続けることで<a href="/terms" target="_blank" style={{ color: '#38ADA9' }}>利用規約</a>・
            <a href="/privacy" target="_blank" style={{ color: '#38ADA9' }}>プライバシーポリシー</a>に同意したものとみなされます。
          </p>
        </form>

        {error && <p style={{ fontSize: 12, color: '#E74C3C', margin: '10px 0 0' }}>{error}</p>}
        {message && <p style={{ fontSize: 12, color: '#27AE60', margin: '10px 0 0', lineHeight: 1.7 }}>{message}</p>}

        {/* ③ パスワード方式（従来ユーザー向け・折りたたみ） */}
        <button type="button" onClick={() => { setPwOpen(v => !v); setError(null); setMessage(null); }} style={{
          marginTop: 16, background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer', padding: 0,
        }}>
          {pwOpen ? '▾ パスワードでログイン / 登録' : '▸ パスワードでログイン / 登録'}
        </button>

        {pwOpen && (
          <div style={{ marginTop: 10, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
            {pwMode !== 'forgot' && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button onClick={() => setPwMode('signin')} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  border: `1.5px solid ${pwMode === 'signin' ? '#38ADA9' : '#ddd'}`,
                  background: pwMode === 'signin' ? '#E8F8F7' : '#fff',
                  color: pwMode === 'signin' ? '#38ADA9' : '#666', fontWeight: 700,
                }}>ログイン</button>
                <button onClick={() => setPwMode('signup')} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  border: `1.5px solid ${pwMode === 'signup' ? '#38ADA9' : '#ddd'}`,
                  background: pwMode === 'signup' ? '#E8F8F7' : '#fff',
                  color: pwMode === 'signup' ? '#38ADA9' : '#666', fontWeight: 700,
                }}>新規登録</button>
              </div>
            )}

            {pwMode === 'forgot' ? (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: '#999', margin: '0 0 4px' }}>
                  登録したメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
                </p>
                <input
                  type="email" placeholder="メールアドレス" value={pwEmail}
                  onChange={e => setPwEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
                <button type="submit" disabled={busy} style={{
                  padding: '10px 0', borderRadius: 10, border: 'none',
                  background: busy ? '#ccc' : '#55524A',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer',
                }}>
                  {busy ? '送信中…' : '再設定メールを送る'}
                </button>
                <button type="button" onClick={() => { setPwMode('signin'); setError(null); setMessage(null); }} style={{
                  background: 'none', border: 'none', color: '#999', fontSize: 12, cursor: 'pointer', padding: 0,
                }}>← ログインへ戻る</button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pwMode === 'signup' && (
                  <input
                    type="text" placeholder="ユーザー名（あとで決めてもOK）" value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={inputStyle}
                  />
                )}
                <input
                  type="email" placeholder="メールアドレス" value={pwEmail}
                  onChange={e => setPwEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
                <input
                  type="password" placeholder="パスワード（6文字以上）" value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  style={inputStyle}
                  required
                />

                {pwMode === 'signin' && (
                  <button type="button" onClick={() => { setPwMode('forgot'); setError(null); setMessage(null); }} style={{
                    alignSelf: 'flex-end', background: 'none', border: 'none', color: '#38ADA9', fontSize: 12, cursor: 'pointer', padding: 0,
                  }}>パスワードをお忘れですか？</button>
                )}

                <button type="submit" disabled={busy} style={{
                  padding: '10px 0', borderRadius: 10, border: 'none',
                  background: busy ? '#ccc' : '#55524A',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy ? 'default' : 'pointer',
                }}>
                  {busy ? '処理中…' : pwMode === 'signup' ? '登録する' : 'ログイン'}
                </button>
              </form>
            )}
          </div>
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
