// 煩悩オークション：BONNO投資ページ（/events/[slug]/invest）
// 参加者が自分のスマホで、共感した煩悩に持ち点（BONNO）を配分する。
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import BonnoInvest from '@/components/bonno/BonnoInvest';
import type { Route } from '@/lib/types';

export const metadata = { title: 'BONNO投資 | ヒトマップ', robots: { index: false } };

export default async function BonnoInvestPage({ params }: { params: { slug: string } }) {
  const { data: route } = await supabaseServer
    .from('routes').select('*').eq('event_slug', params.slug).eq('is_deleted', false).single();
  if (!route || (route as Route).event_mode !== 'bonno') notFound();
  return <BonnoInvest route={route as Route} />;
}
