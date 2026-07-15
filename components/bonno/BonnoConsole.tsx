'use client';

// ============================================================
// 煩悩オークション：運営コンソール
// ・投稿の一覧（3秒ポーリング、hidden含む全件）
// ・スポットライト指名/解除、非表示/戻す
// ・AI分析の実行と全体講評の表示
// ・参加用QRコード（印刷して受付に置ける）
// パスワードは初回入力後 sessionStorage に保持し、x-admin-password ヘッダで送る。
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { BonnoSubmission, Route } from '@/lib/types';
import { colors, radii, shadows } from '@/lib/theme';

const POLL_MS = 3000;
const STORAGE_KEY = 'bonno_console_password';

export default function BonnoConsole({ route }: { route: Route }) {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [items, setItems] = useState<BonnoSubmission[]>([]);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);
  const [eventUrl, setEventUrl] = useState('');

  const load = useCallback(async (pw: string) => {
    const res = await fetch(`/api/bonno?event_slug=${encodeURIComponent(route.event_slug ?? '')}`, {
      headers: { 'x-admin-password': pw },
    });
    const data = await res.json();
    if (!data.ok) return false;
    const rows = (data.items as BonnoSubmission[]).slice().reverse(); // 新着順
    // status が返ってきていれば admin として認証されている
    const isAdminResponse = rows.length === 0 || 'status' in rows[0];
    if (!isAdminResponse) return false;
    setItems(rows);
    setSpotlightId(data.spotlight_id ?? null);
    return true;
  }, [route.event_slug]);

  // 初回：保存済みパスワードで自動ログインを試す
  useEffect(() => {
    setEventUrl(`${window.location.origin}/events/${route.event_slug}`);
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      load(saved).then((ok) => {
        if (ok) { setPassword(saved); setAuthed(true); }
        else sessionStorage.removeItem(STORAGE_KEY);
      });
    }
  }, [load, route.event_slug]);

  useEffect(() => {
    if (!authed) return;
    const timer = setInterval(() => load(password), POLL_MS);
    return () => clearInterval(timer);
  }, [authed, password, load]);

  const login = async () => {
    setAuthError(null);
    const ok = await load(password);
    if (ok) {
      sessionStorage.setItem(STORAGE_KEY, password);
      setAuthed(true);
    } else {
      setAuthError('パスワードが違います');
    }
  };

  const act = async (id: string, action: 'hide' | 'show' | 'spotlight' | 'unspotlight') => {
    await fetch(`/api/bonno/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ action }),
    });
    load(password);
  };

  const runAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeMsg(null);
    try {
      const res = await fetch('/api/bonno/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ event_slug: route.event_slug }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAnalyzeMsg(data.error ?? '分析に失敗しました');
      } else {
        setAnalyzeMsg(
          data.analyzed > 0
            ? `${data.analyzed}件を分析しました${data.remaining ? '（未分析が残っています。もう一度実行してください）' : ''}`
            : data.message ?? '未分析の煩悩はありません'
        );
        if (data.review) setReview(data.review);
        load(password);
      }
    } catch {
      setAnalyzeMsg('通信に失敗しました');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!authed) {
    return (
      <main style={{ minHeight: '100dvh', background: colors.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: colors.surface, borderRadius: radii.lg, boxShadow: shadows.card, padding: '32px 28px', width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary, margin: '0 0 6px' }}>運営コンソール</h1>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 20px' }}>{route.title}</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="管理パスワード"
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: radii.md, border: `1px solid ${colors.border}`, fontSize: 16, marginBottom: 14 }}
          />
          {authError && <p style={{ fontSize: 13, color: colors.danger, margin: '0 0 12px' }}>{authError}</p>}
          <button
            onClick={login}
            style={{ width: '100%', padding: '13px 0', borderRadius: radii.pill, border: 'none', background: colors.primary, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
          >
            入室する
          </button>
        </div>
      </main>
    );
  }

  const visibleCount = items.filter((it) => it.status === 'visible').length;
  const analyzedCount = items.filter((it) => it.analyzed_at).length;

  return (
    <main style={{ minHeight: '100dvh', background: colors.surfaceMuted, padding: '24px 16px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, margin: '0 0 4px' }}>
          運営コンソール
        </h1>
        <p style={{ fontSize: 13, color: colors.textMuted, margin: '0 0 20px' }}>{route.title}</p>

        {/* 状況＋操作パネル */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ flex: '1 1 200px', background: colors.surface, borderRadius: radii.lg, boxShadow: shadows.card, padding: '16px 18px' }}>
            <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 4px' }}>奉納された煩悩</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
              {items.length}<span style={{ fontSize: 13, fontWeight: 400, color: colors.textMuted }}> 件（表示中 {visibleCount}・分析済み {analyzedCount}）</span>
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <a href={`/events/${route.event_slug}/wall`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, color: colors.accent, textDecoration: 'none', border: `1px solid ${colors.accent}`, borderRadius: radii.pill, padding: '6px 14px' }}>
                投影ウォール ↗
              </a>
              <a href={`/events/${route.event_slug}/analysis`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, color: colors.purple, textDecoration: 'none', border: `1px solid ${colors.purple}`, borderRadius: radii.pill, padding: '6px 14px' }}>
                分析ダッシュボード ↗
              </a>
              <button onClick={runAnalyze} disabled={analyzing}
                style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: analyzing ? colors.textFaint : colors.primary, border: 'none', borderRadius: radii.pill, padding: '6px 14px', cursor: analyzing ? 'default' : 'pointer' }}>
                {analyzing ? '分析中…' : 'AI分析を実行'}
              </button>
            </div>
            {analyzeMsg && <p style={{ fontSize: 12, color: colors.textSecondary, margin: '10px 0 0' }}>{analyzeMsg}</p>}
          </div>
          <div style={{ background: colors.surface, borderRadius: radii.lg, boxShadow: shadows.card, padding: '14px 16px', textAlign: 'center' }}>
            {eventUrl && <QRCodeSVG value={eventUrl} size={96} fgColor={colors.textPrimary} />}
            <p style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, margin: '6px 0 0' }}>参加用QR</p>
          </div>
        </div>

        {/* AI全体講評 */}
        {review && (
          <div style={{ background: colors.purpleBg, border: `1px solid ${colors.purple}`, borderRadius: radii.lg, padding: '14px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: colors.purple, margin: '0 0 6px' }}>AIによる全体講評（下書き・外部公開前に要確認）</p>
            <p style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{review}</p>
          </div>
        )}

        {/* 投稿リスト（新着順） */}
        {items.length === 0 ? (
          <p style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', padding: '40px 0' }}>まだ投稿はありません</p>
        ) : items.map((it) => {
          const isSpot = it.id === spotlightId;
          const isHidden = it.status === 'hidden';
          return (
            <div key={it.id} style={{
              background: colors.surface,
              borderRadius: radii.md,
              boxShadow: shadows.card,
              padding: '14px 16px',
              marginBottom: 10,
              opacity: isHidden ? 0.55 : 1,
              border: isSpot ? `2px solid ${colors.gold}` : `1px solid ${colors.borderSoft}`,
            }}>
              <p style={{ fontSize: 15, color: colors.textPrimary, lineHeight: 1.7, margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{it.text}</p>
              <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 10px' }}>
                {it.nickname ?? '匿名'}
                {' ・ '}{new Date(it.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                {it.intensity_score && <span style={{ color: colors.gold, fontWeight: 700 }}>{' ・ '}切実さ {'●'.repeat(it.intensity_score)}{'○'.repeat(5 - it.intensity_score)}</span>}
                {isSpot && <span style={{ color: colors.gold, fontWeight: 800 }}>{' ・ '}🔦 スポットライト中</span>}
                {isHidden && <span style={{ color: colors.danger, fontWeight: 700 }}>{' ・ '}非表示中</span>}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!isHidden && (isSpot ? (
                  <button onClick={() => act(it.id, 'unspotlight')}
                    style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: radii.pill, border: 'none', background: colors.gold, color: '#fff', cursor: 'pointer' }}>
                    スポットライト解除
                  </button>
                ) : (
                  <button onClick={() => act(it.id, 'spotlight')}
                    style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: radii.pill, border: `1px solid ${colors.gold}`, background: 'transparent', color: colors.gold, cursor: 'pointer' }}>
                    🔦 スポットライト
                  </button>
                ))}
                {isHidden ? (
                  <button onClick={() => act(it.id, 'show')}
                    style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: radii.pill, border: `1px solid ${colors.primary}`, background: 'transparent', color: colors.primary, cursor: 'pointer' }}>
                    表示に戻す
                  </button>
                ) : (
                  <button onClick={() => act(it.id, 'hide')}
                    style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: radii.pill, border: `1px solid ${colors.danger}`, background: 'transparent', color: colors.danger, cursor: 'pointer' }}>
                    非表示にする
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
