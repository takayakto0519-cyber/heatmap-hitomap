'use client';

// ============================================================
// 煩悩オークション：BONNO投資ページ（/events/[slug]/invest）
// 参加者は自分のスマホで、共感した煩悩に持ち点（BONNO）を配分する。
// voter_token はブラウザ側でcrypto.randomUUID()により生成しlocalStorageに保持する。
// 同じ端末なら再訪問時も予算状態が引き継がれる（別端末での二重取得は防げない）。
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import type { Route } from '@/lib/types';
import { colors, radii } from '@/lib/theme';

interface InvestItem {
  id: string;
  text: string;
  nickname: string | null;
  total_bonno: number;
  created_at: string;
}

const POLL_MS = 2500;
const INVEST_STEP = 10;

function voterTokenKey(eventSlug: string) {
  return `bonno_voter_token_${eventSlug}`;
}

function getOrCreateVoterToken(eventSlug: string): string {
  const key = voterTokenKey(eventSlug);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

export default function BonnoInvest({ route }: { route: Route }) {
  const eventSlug = route.event_slug ?? '';
  const [items, setItems] = useState<InvestItem[]>([]);
  const [voterToken, setVoterToken] = useState<string | null>(null);
  const [budget, setBudget] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/bonno?event_slug=${encodeURIComponent(eventSlug)}`);
      const data = await res.json();
      if (data.ok) setItems(data.items as InvestItem[]);
    } catch {
      // 瞬断は次のポーリングで回復
    }
  }, [eventSlug]);

  const loadBudget = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/bonno/invest?event_slug=${encodeURIComponent(eventSlug)}&voter_token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!data.ok) return;
      setBudget(data.budget);
      setRemaining(data.remaining);
      const map: Record<string, number> = {};
      for (const a of data.allocations as Array<{ submission_id: string; amount: number }>) {
        map[a.submission_id] = a.amount;
      }
      setAllocations(map);
    } catch {
      // 次のポーリングで回復
    }
  }, [eventSlug]);

  useEffect(() => {
    const token = getOrCreateVoterToken(eventSlug);
    setVoterToken(token);
    loadItems();
    loadBudget(token);
    const timer = setInterval(loadItems, POLL_MS);
    return () => clearInterval(timer);
  }, [eventSlug, loadItems, loadBudget]);

  const invest = async (submissionId: string) => {
    if (!voterToken || pending) return;
    if (remaining < INVEST_STEP) {
      setError('残り予算が足りません');
      return;
    }
    setPending(submissionId);
    setError(null);
    try {
      const res = await fetch('/api/bonno/invest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_slug: eventSlug,
          submission_id: submissionId,
          voter_token: voterToken,
          amount: INVEST_STEP,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '投資に失敗しました');
        return;
      }
      setRemaining(data.remaining);
      setAllocations((prev) => ({ ...prev, [submissionId]: (prev[submissionId] ?? 0) + INVEST_STEP }));
      setItems((prev) => prev.map((it) => it.id === submissionId ? { ...it, total_bonno: data.submission_total } : it));
    } catch {
      setError('通信に失敗しました。電波の良い場所でもう一度お試しください');
    } finally {
      setPending(null);
    }
  };

  return (
    <main style={{
      minHeight: '100dvh',
      background: colors.surfaceMuted,
      padding: '24px 16px 100px',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <p style={{ fontSize: 12, letterSpacing: 2, color: colors.textMuted, margin: '0 0 6px' }}>
          BONNO投資
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary, margin: '0 0 6px', lineHeight: 1.35 }}>
          気になった煩悩にBONNOを投資しよう
        </h1>
        <p style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.8, margin: '0 0 20px' }}>
          持ち点のBONNOを、気になった煩悩に配ってください。いちばん多く集めた煩悩が「本日の最高落札煩悩」に選ばれます。
        </p>

        {/* 残り予算バー */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: colors.surface,
          border: `1px solid ${colors.borderSoft}`,
          borderRadius: radii.lg,
          padding: '14px 18px',
          marginBottom: 18,
        }}>
          <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 4px' }}>残り予算</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: remaining > 0 ? colors.primary : colors.danger, margin: 0 }}>
            {remaining} <span style={{ fontSize: 14, fontWeight: 400, color: colors.textMuted }}>/ {budget} BONNO</span>
          </p>
          <div style={{ height: 8, background: colors.trackBg, borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
            <div style={{
              width: budget > 0 ? `${(remaining / budget) * 100}%` : '0%',
              height: '100%',
              background: colors.primary,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: colors.danger, margin: '0 0 14px' }}>{error}</p>
        )}

        {items.length === 0 ? (
          <p style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', padding: '40px 0' }}>
            まだ煩悩が奉納されていません
          </p>
        ) : items.map((it) => {
          const myAmount = allocations[it.id] ?? 0;
          const disabled = pending === it.id || remaining < INVEST_STEP;
          return (
            <div key={it.id} style={{
              background: colors.surface,
              border: `1px solid ${colors.borderSoft}`,
              borderRadius: radii.md,
              padding: '14px 16px',
              marginBottom: 10,
            }}>
              <p style={{ fontSize: 15, color: colors.textPrimary, lineHeight: 1.7, margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>
                {it.text}
              </p>
              <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 10px' }}>
                💰 <strong style={{ color: colors.gold }}>{it.total_bonno} BONNO</strong>
                {myAmount > 0 && <span style={{ color: colors.accent }}>{`　あなた：${myAmount}`}</span>}
              </p>
              <button
                onClick={() => invest(it.id)}
                disabled={disabled}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: radii.pill,
                  border: 'none',
                  background: disabled ? colors.trackBg : colors.primary,
                  color: disabled ? colors.textFaint : '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: disabled ? 'default' : 'pointer',
                }}
              >
                {pending === it.id ? '投資中…' : `+${INVEST_STEP} BONNO`}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
