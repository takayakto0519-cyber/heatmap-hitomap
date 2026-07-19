// GET /api/admin/relation-population — 関係人口ダッシュボード（パスワード必須）
//   パラメータなし ... 全体の総数＋地域別ランキング（上位10、少人数は非表示）
//   ?region=<自治体名> ... その自治体の詳細集計
// agents/relation_population.py（番人63）と同じ考え方をサイト本体からライブに読む。
// 応答は件数・割合のみで、個人を特定できる値は一切含めない。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { computeRelationPopulationOverall, computeRelationPopulationForRegion } from '@/lib/relationPopulation';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function GET(req: NextRequest) {
  if (!SUPABASE_READY) {
    return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }

  const region = req.nextUrl.searchParams.get('region');
  const { supabaseServer } = await import('@/lib/supabase/server');

  if (region) {
    const result = await computeRelationPopulationForRegion(supabaseServer, region);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  const result = await computeRelationPopulationOverall(supabaseServer);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
