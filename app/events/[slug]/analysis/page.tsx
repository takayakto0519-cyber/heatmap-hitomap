// 煩悩オークション：AI分析ダッシュボード（/events/[slug]/analysis）
// 頻出ワードのタグクラウド＋ランキング、切実さのバブルチャート。投影用の黒背景。
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import BonnoAnalysis from '@/components/bonno/BonnoAnalysis';
import type { Route } from '@/lib/types';

export const metadata = { title: '煩悩の解析 | ヒトマップ', robots: { index: false } };

export default async function BonnoAnalysisPage({ params }: { params: { slug: string } }) {
  const { data: route } = await supabaseServer
    .from('routes').select('*').eq('event_slug', params.slug).eq('is_deleted', false).single();
  if (!route || (route as Route).event_mode !== 'bonno') notFound();
  return <BonnoAnalysis route={route as Route} />;
}
