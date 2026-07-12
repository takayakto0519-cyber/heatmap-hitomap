// GET /api/mobility/context?region=... — 「人流コンテキスト」の状態を返す。
// フェーズ0：e-Stat（無料・要アプリケーションID）が設定されていれば実データを、
// 未設定なら「まだ連携できません」という状態を返し、UI側で案内を出せるようにする。
import { NextRequest, NextResponse } from 'next/server';
import { isEstatConfigured, fetchEstatStatsData } from '@/lib/estat';

export async function GET(req: NextRequest) {
  if (!isEstatConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: 'e-StatのアプリケーションID（ESTAT_APP_ID）が未設定です。無料登録で人流の目安データと比較できるようになります。',
    });
  }

  const statsDataId = req.nextUrl.searchParams.get('stats_data_id');
  const cdArea = req.nextUrl.searchParams.get('cd_area') ?? undefined;
  if (!statsDataId) {
    return NextResponse.json({
      ok: true,
      configured: true,
      message: '比較する統計表（stats_data_id）が未指定です。観光庁の宿泊旅行統計調査など、比較したい統計表をe-Statで調べて指定してください。',
    });
  }

  try {
    const data = await fetchEstatStatsData({ statsDataId, cdArea });
    return NextResponse.json({ ok: true, configured: true, data });
  } catch (e) {
    return NextResponse.json({
      ok: false, configured: true,
      error: e instanceof Error ? e.message : 'e-Statからのデータ取得に失敗しました',
    }, { status: 502 });
  }
}
