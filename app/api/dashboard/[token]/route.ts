// GET /api/dashboard/[token] : 顧客専用ダッシュボードのデータ取得（Phase 2）
// トークンだけで認証する（Supabase Authのアカウント登録は不要）。
// 有効なトークンでも、返すのは lib/regionAggregate.ts の集計結果のみ。
// 個別トレースの座標・写真・自由記述は一切含まれない。
import { NextRequest, NextResponse } from 'next/server';
import { computeRegionAggregate } from '@/lib/regionAggregate';
import type { DashboardAccess, DashboardResponse } from '@/lib/types';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  if (!SUPABASE_READY) {
    return NextResponse.json<DashboardResponse>({ ok: false, label: null, error: 'Supabase未設定' }, { status: 503 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');

  const { data: access, error } = await supabaseServer
    .from('dashboard_access')
    .select('*')
    .eq('token', params.token)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json<DashboardResponse>({ ok: false, label: null, error: error.message }, { status: 500 });
  }
  if (!access) {
    return NextResponse.json<DashboardResponse>({ ok: false, label: null, error: '無効なURLです' }, { status: 404 });
  }

  const typedAccess = access as DashboardAccess;

  // アクセスログ代わりに最終閲覧日時を更新する（失敗しても閲覧自体は継続させる）
  await supabaseServer
    .from('dashboard_access')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', typedAccess.id);

  const aggregate = await computeRegionAggregate(supabaseServer, typedAccess.region);

  return NextResponse.json<DashboardResponse>({
    ok: true,
    label: typedAccess.label,
    aggregate,
  });
}
