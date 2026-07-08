'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthBrowserClient } from '@/lib/supabase/authClient';

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null) {
    const withMessage = err as { message?: unknown; error_description?: unknown };
    if (typeof withMessage.message === 'string' && withMessage.message) return withMessage.message;
    if (typeof withMessage.error_description === 'string' && withMessage.error_description) return withMessage.error_description;
  }
  return 'パスワードの更新に失敗しました。時間をおいて再度お試しください。';
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createAuthBrowserClient();
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => { router.push('/map'); router.refresh(); }, 1500);
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
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>新しいパスワードを設定</h1>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 18 }}>
          メールのリンクからこのページを開いた場合、そのまま新しいパスワードを入力してください。
        </p>

        {done ? (
          <p style={{ fontSize: 13, color: '#27AE60' }}>✓ パスワードを更新しました。マップに移動します…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="password" placeholder="新しいパスワード（6文字以上）" value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
              required
            />
            {error && <p style={{ fontSize: 12, color: '#E74C3C', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={busy} style={{
              padding: '11px 0', borderRadius: 10, border: 'none', marginTop: 4,
              background: busy ? '#ccc' : 'linear-gradient(135deg, #FF6B9D, #FF9068)',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer',
            }}>
              {busy ? '更新中…' : 'パスワードを更新する'}
            </button>
          </form>
        )}

        <p style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f0f0', fontSize: 11, color: '#bbb', textAlign: 'center' }}>
          お困りの際は <a href="mailto:hitomap.info@gmail.com" style={{ color: '#999' }}>hitomap.info@gmail.com</a> までご連絡ください
        </p>
      </div>
    </div>
  );
}
