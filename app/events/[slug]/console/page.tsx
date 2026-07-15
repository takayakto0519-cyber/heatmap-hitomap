// 煩悩オークション：運営コンソール（/events/[slug]/console）
// スポットライト指名・非表示などの当日操作を行う。中身の操作はパスワード必須。
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import BonnoConsole from '@/components/bonno/BonnoConsole';
import type { Route } from '@/lib/types';

export const metadata = { title: '煩悩オークション 運営 | ヒトマップ', robots: { index: false } };

export default async function BonnoConsolePage({ params }: { params: { slug: string } }) {
  const { data: route } = await supabaseServer
    .from('routes').select('*').eq('event_slug', params.slug).eq('is_deleted', false).single();
  if (!route || (route as Route).event_mode !== 'bonno') notFound();
  return <BonnoConsole route={route as Route} />;
}
