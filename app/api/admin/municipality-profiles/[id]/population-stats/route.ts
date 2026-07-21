// POST /api/admin/municipality-profiles/[id]/population-stats
// 感情ヒートマップと組み合わせる「自治体単位の人口統計」を、運営ダッシュボードから
// ボタンを押した時だけe-Statに取りに行き、municipality_profilesにキャッシュする。
// 国勢調査は5年に1度しか更新されないため、cronでの自動更新はしない
// （顧客向けダッシュボード app/dashboard/[token]/page.tsx は、ここで保存した値を読むだけ）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { fetchEstatStatsData, requireCensusStatsDataId, extractDayNightRatio } from '@/lib/estat';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: profile, error: fetchError } = await supabaseServer
    .from('municipality_profiles').select('id, municipality_code').eq('id', params.id).maybeSingle();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ ok: false, error: '自治体プロファイルが見つかりません' }, { status: 404 });
  if (!profile.municipality_code) {
    return NextResponse.json({ ok: false, error: '全国地方公共団体コードが未入力です' }, { status: 400 });
  }

  let statsDataId: string;
  try {
    statsDataId = requireCensusStatsDataId();
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }

  try {
    const raw = await fetchEstatStatsData({ statsDataId, cdArea: profile.municipality_code });
    const parsed = extractDayNightRatio(raw);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: 'e-Statのレスポンスから数値を読み取れませんでした（統計表IDまたは地域コードを確認してください）' }, { status: 502 });
    }

    const populationStats = {
      dayNightRatio: parsed.value,
      statsYear: parsed.time,
      statsDataId,
      fetchedAt: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('municipality_profiles')
      .update({ population_stats: populationStats, population_stats_fetched_at: new Date().toISOString() })
      .eq('id', params.id).select().single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, profile: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'e-Statからの取得に失敗しました' }, { status: 502 });
  }
}
