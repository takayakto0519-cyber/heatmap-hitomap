// GET /api/admin/geo/municipality-boundary?code=09204
// 運営ダッシュボードの「市区町村から選ぶ」UI用。全国地方公共団体コードを受け取り、
// 境界ポリゴン（GeoJSON）とそこから導出したbboxを返す（パスワード必須）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import { getMunicipalityBoundary, bboxFromGeometry } from '@/lib/municipalityBoundary';

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });
  }

  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ ok: false, error: 'code は必須です' }, { status: 400 });
  }

  const boundary = await getMunicipalityBoundary(code);
  if (!boundary) {
    return NextResponse.json(
      { ok: false, error: '境界データが見つかりません（scripts/fetch-municipality-boundaries.mjsが未実行か、コードが不正です）' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    name: boundary.name,
    geojson: boundary.geometry,
    bbox: bboxFromGeometry(boundary.geometry),
  });
}
