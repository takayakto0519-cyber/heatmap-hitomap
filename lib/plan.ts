// ============================================================
// 個人向け有料プランの土台（Phase 3）。
//
// 何を無料に残し何を有料にするかはまだ決まっていない（会長・小田さんの
// ビジネス判断待ち）。ここでは「plan列を見て判定する」という配線だけを
// 用意し、実際に何かをこの関数で覆う（機能制限する）のは、対象機能が
// 決まってから行う。決済処理（Stripe等）も未接続——STRIPE_SECRET_KEY が
// 無い環境では /api/billing/checkout は「未設定」を返すだけで、
// 偽の決済フローは作らない。
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';

export const PLAN = {
  FREE: 'free',
  SUPPORTER: 'supporter',
} as const;

export type Plan = (typeof PLAN)[keyof typeof PLAN];

export async function getUserPlan(supabaseServer: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await supabaseServer.from('profiles').select('plan').eq('id', userId).maybeSingle();
  const plan = (data as { plan?: string } | null)?.plan;
  return plan === PLAN.SUPPORTER ? PLAN.SUPPORTER : PLAN.FREE;
}

export async function hasPaidPlan(supabaseServer: SupabaseClient, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const plan = await getUserPlan(supabaseServer, userId);
  return plan !== PLAN.FREE;
}
