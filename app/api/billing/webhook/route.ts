// POST /api/billing/webhook : Stripeからのイベント通知を受けて profiles.plan を同期する。
//
// 署名検証（STRIPE_WEBHOOK_SECRET）に失敗したリクエストは即座に拒否する。
// 扱うイベントは最小限：
//   checkout.session.completed        → サブスク開始。plan='supporter'
//   customer.subscription.updated     → 状態変化（active以外ならfreeに戻す）
//   customer.subscription.deleted     → 解約。plan='free'
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { PLAN } from '@/lib/plan';

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ ok: false, error: 'Stripe未設定' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error('署名ヘッダーがありません');
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `署名検証に失敗: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');

  async function setPlanByCustomerId(customerId: string, plan: string, subscriptionId: string | null) {
    await supabaseServer
      .from('profiles')
      .update({ plan, plan_updated_at: new Date().toISOString(), stripe_subscription_id: subscriptionId })
      .eq('stripe_customer_id', customerId);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
      if (customerId) await setPlanByCustomerId(customerId, PLAN.SUPPORTER, subscriptionId);
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      const isActive = subscription.status === 'active' || subscription.status === 'trialing';
      await setPlanByCustomerId(customerId, isActive ? PLAN.SUPPORTER : PLAN.FREE, isActive ? subscription.id : null);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
