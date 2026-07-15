// POST /api/billing/checkout : 個人向け支援プランのStripe Checkoutセッション作成（Phase 3）
//
// STRIPE_SECRET_KEY / STRIPE_PRICE_ID が未設定の間は「準備中」を返すだけで、
// 偽の決済フローは一切作らない。価格・プラン名はコードに埋め込まず、
// Stripeダッシュボード側で作成したPriceのID（STRIPE_PRICE_ID）を参照する
// ——値上げ・プラン変更のたびにコードを触らずに済むようにするため。
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createRequestClient } from '@/lib/supabase/requestClient';

const NOT_CONFIGURED = 'サポータープランは準備中です。決済基盤（Stripe）が未接続のため、現時点ではお申し込みいただけません。';

export async function POST() {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hitomap.com';

  if (!stripe || !priceId) {
    return NextResponse.json({ ok: false, error: NOT_CONFIGURED }, { status: 503 });
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

  let customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;

  if (!customerId) {
    // ユーザーごとに固定のキーにすることで、ネットワーク再送で顧客が二重作成されるのを防ぐ
    // （既にstripe_customer_idが保存されていれば、そもそもこのブロックに入らない）
    const customer = await stripe.customers.create(
      {
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      },
      { idempotencyKey: `hitomap-customer-${user.id}` }
    );
    customerId = customer.id;
    await supabaseServer.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}/support?checkout=success`,
      cancel_url: `${SITE_URL}/support?checkout=cancelled`,
      metadata: { supabase_user_id: user.id },
    },
    // リクエストごとに新しいキー：ボタンの二重クリック起因の通信リトライだけを重複排除し、
    // 別タイミングでの再度の申し込みは新しいセッションとして作れるようにする
    { idempotencyKey: randomUUID() }
  );

  if (!session.url) {
    return NextResponse.json({ ok: false, error: 'Checkoutセッションの作成に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: session.url });
}
