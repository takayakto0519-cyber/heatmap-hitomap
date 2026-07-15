import type { Metadata } from 'next';
import { corpColor, corpFont } from '@/components/corp/tokens';
import SupportButton from '@/components/billing/SupportButton';
import { getCurrentUserId } from '@/lib/supabase/requestClient';
import { getUserPlan, PLAN } from '@/lib/plan';

export const metadata: Metadata = {
  title: 'サポーターになる',
  description: 'ヒトマップの継続を支えるサポータープランについて。',
};

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const BILLING_READY = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

export default async function SupportPage({ searchParams }: { searchParams: { checkout?: string } }) {
  const userId = SUPABASE_READY ? await getCurrentUserId() : null;

  let plan: string = PLAN.FREE;
  if (userId) {
    const { supabaseServer } = await import('@/lib/supabase/server');
    plan = await getUserPlan(supabaseServer, userId);
  }

  return (
    <div style={{ minHeight: '100dvh', background: corpColor.ground, fontFamily: corpFont.body }}>
      <header style={{ padding: '18px 24px', borderBottom: `1px solid ${corpColor.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logo.png" alt="ヒトマップ" style={{ height: 24, width: 'auto' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: corpColor.ink }}>ヒトマップ</span>
        </a>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px 96px' }}>
        <p style={{ margin: '0 0 18px', fontSize: 12, letterSpacing: '0.2em', color: corpColor.moss, fontWeight: 700 }}>
          SUPPORT
        </p>
        <h1 style={{ margin: '0 0 24px', fontFamily: corpFont.mincho, fontSize: 'clamp(24px, 3.4vw, 30px)', color: corpColor.ink, fontWeight: 600, lineHeight: 1.7 }}>
          記録を続ける人たちを、続けられる形で支えたい。
        </h1>
        <p style={{ margin: '0 0 32px', fontSize: 14, lineHeight: 2, color: corpColor.inkSoft }}>
          ヒトマップの基本機能は、これからも無料で使えます。サポータープランは、
          運営を継続的に支えたい方向けの任意の支援です（具体的な特典はまだ検討中です）。
        </p>

        {searchParams.checkout === 'success' && (
          <p style={{ margin: '0 0 24px', padding: '14px 16px', background: corpColor.white, border: `1px solid ${corpColor.line}`, fontSize: 13, color: corpColor.ink }}>
            お手続きありがとうございます。反映まで少し時間がかかる場合があります。
          </p>
        )}
        {searchParams.checkout === 'cancelled' && (
          <p style={{ margin: '0 0 24px', padding: '14px 16px', background: corpColor.white, border: `1px solid ${corpColor.line}`, fontSize: 13, color: corpColor.inkSoft }}>
            手続きはキャンセルされました。
          </p>
        )}

        {!userId ? (
          <div>
            <a
              href="/login"
              style={{
                display: 'inline-block', padding: '15px 32px', background: corpColor.ink, color: corpColor.white,
                textDecoration: 'none', fontWeight: 700, fontSize: 14, letterSpacing: '0.05em',
              }}
            >
              ログインして手続きする
            </a>
          </div>
        ) : plan === PLAN.SUPPORTER ? (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: corpColor.moss }}>
            すでにサポーターです。ありがとうございます。
          </p>
        ) : !BILLING_READY ? (
          <p style={{ margin: 0, fontSize: 13, color: corpColor.inkSoft, lineHeight: 1.9 }}>
            サポータープランは現在準備中です。開始次第、このページからお申し込みいただけます。
          </p>
        ) : (
          <SupportButton />
        )}
      </main>
    </div>
  );
}
