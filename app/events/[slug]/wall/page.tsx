// 煩悩オークション：投影ウォール（/events/[slug]/wall）
// プロジェクターに映すノートPCでこのページを全画面表示する。
// bonno型イベント以外のslugでは404。
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import BonnoWall from '@/components/bonno/BonnoWall';
import type { Route } from '@/lib/types';

export const metadata = { title: '煩悩の壁 | ヒトマップ', robots: { index: false } };

export default async function BonnoWallPage({ params }: { params: { slug: string } }) {
  const { data: route } = await supabaseServer
    .from('routes').select('*').eq('event_slug', params.slug).eq('is_deleted', false).single();
  if (!route || (route as Route).event_mode !== 'bonno') notFound();
  return <BonnoWall route={route as Route} />;
}
