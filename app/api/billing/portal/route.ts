// POST /api/billing/portal : Stripeカスタマーポータルへのリンクを発行する。
// サポーターが自分で解約・支払い方法変更をできるようにする（Stripe推奨のホスト型ポータル）。
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createRequestClient } from '@/lib/supabase/requestClient';

export async function POST() {
  const stripe = getStripe();
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

  if (!stripe) {
    return NextResponse.json({ ok: false, error: 'Stripe未設定' }, { status: 503 });
  }

  const supabase = createRequestClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: profile } = await supabaseServer
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
  if (!customerId) {
    return NextResponse.json({ ok: false, error: 'お申し込み履歴が見つかりません' }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${SITE_URL}/support`,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
