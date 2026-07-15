// サーバー用 Stripe クライアント。
// STRIPE_SECRET_KEY が未設定の間は null を返す（決済まわりのAPIは全て
// この null チェックで「準備中」を返し、偽の決済フローは作らない）。
import Stripe from 'stripe';

let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}
