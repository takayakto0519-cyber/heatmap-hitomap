// 煩悩オークション：BONNO投資ボード（/events/[slug]/board）
// total_bonno降順のランキング表示。1位には「本日の最高落札煩悩」ラベル。投影用の黒背景。
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import BonnoBoard from '@/components/bonno/BonnoBoard';
import type { Route } from '@/lib/types';

export const metadata = { title: 'BONNO投資ボード | ヒトマップ', robots: { index: false } };

export default async function BonnoBoardPage({ params }: { params: { slug: string } }) {
  const { data: route } = await supabaseServer
    .from('routes').select('*').eq('event_slug', params.slug).eq('is_deleted', false).single();
  if (!route || (route as Route).event_mode !== 'bonno') notFound();
  return <BonnoBoard route={route as Route} />;
}
