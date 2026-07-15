'use client';

// ============================================================
// 煩悩オークション：イベントトップ兼投稿フォーム（/events/[slug]）
// 会場のQRコードからスマホで開き、煩悩を書いて「奉納」する。
// 投稿は即時に会場の投影ウォール（/events/[slug]/wall）へ浮かび上がる。
// ============================================================
import { useState } from 'react';
import type { Route } from '@/lib/types';
import { colors, radii } from '@/lib/theme';

const MAX_TEXT_LENGTH = 100;
const MAX_NICKNAME_LENGTH = 20;

export default function BonnoEventClient({ route }: { route: Route }) {
  const [text, setText] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_TEXT_LENGTH - text.length;

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bonno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_slug: route.event_slug,
          text: trimmed,
          nickname: nickname.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '投稿に失敗しました。もう一度お試しください');
        return;
      }
      setDone(true);
      setText('');
    } catch {
      setError('通信に失敗しました。電波の良い場所でもう一度お試しください');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{
      minHeight: '100dvh',
      background: colors.surfaceMuted,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 20px 60px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <p style={{ fontSize: 12, letterSpacing: 2, color: colors.textMuted, margin: '0 0 6px' }}>
          ヒトマップ・イベント
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: colors.textPrimary, margin: '0 0 10px', lineHeight: 1.35 }}>
          {route.title}
        </h1>
        {route.description && (
          <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.8, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>
            {route.description}
          </p>
        )}

        {done ? (
          <div style={{
            background: colors.surface,
            border: `1px solid ${colors.borderSoft}`,
            borderRadius: radii.lg,
            padding: '40px 24px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>🙏</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary, margin: '0 0 8px' }}>
              奉納しました
            </p>
            <p style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.8, margin: '0 0 24px' }}>
              あなたの煩悩は、まもなく会場の壁に浮かび上がります。
            </p>
            <button
              onClick={() => { setDone(false); setError(null); }}
              style={{
                padding: '12px 28px',
                borderRadius: radii.pill,
                border: `1.5px solid ${colors.primary}`,
                background: 'transparent',
                color: colors.primary,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              もうひとつ書く
            </button>
          </div>
        ) : (
          <div style={{
            background: colors.surface,
            border: `1px solid ${colors.borderSoft}`,
            borderRadius: radii.lg,
            padding: '24px 20px',
          }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: colors.textSecondary, marginBottom: 8 }}>
              あなたの煩悩
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
              placeholder="例：深夜のラーメンがやめられない"
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
                fontSize: 16,
                lineHeight: 1.7,
                color: colors.textPrimary,
                background: colors.surfaceMuted,
                resize: 'vertical',
              }}
            />
            <p style={{
              fontSize: 12,
              color: remaining <= 10 ? colors.danger : colors.textFaint,
              textAlign: 'right',
              margin: '6px 0 16px',
            }}>
              あと{remaining}字
            </p>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: colors.textSecondary, marginBottom: 8 }}>
              ニックネーム（任意）
            </label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, MAX_NICKNAME_LENGTH))}
              placeholder="匿名のままでも大丈夫です"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
                fontSize: 16,
                color: colors.textPrimary,
                background: colors.surfaceMuted,
                marginBottom: 20,
              }}
            />

            {error && (
              <p style={{ fontSize: 13, color: colors.danger, margin: '0 0 14px' }}>{error}</p>
            )}

            <button
              onClick={submit}
              disabled={!text.trim() || submitting}
              style={{
                width: '100%',
                padding: '15px 0',
                borderRadius: radii.pill,
                border: 'none',
                background: !text.trim() || submitting ? colors.trackBg : colors.primary,
                color: !text.trim() || submitting ? colors.textFaint : '#fff',
                fontSize: 16,
                fontWeight: 800,
                cursor: !text.trim() || submitting ? 'default' : 'pointer',
              }}
            >
              {submitting ? '奉納中…' : 'この煩悩を奉納する'}
            </button>
            <p style={{ fontSize: 11, color: colors.textFaint, lineHeight: 1.7, margin: '14px 0 0' }}>
              投稿された煩悩は会場の壁に投影されます。個人が特定される内容や、他の人を傷つける言葉は控えてください。運営の判断で表示を取り下げる場合があります。
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
