// GET /api/geocode/search?q=... — 住所・地名の検索をサーバー側でプロキシする
// ブラウザから直接Nominatimを叩くと、User-Agent未設定や大量アクセスでレート制限・ブロックの対象になりやすいため、
// サーバー側で正しいUser-Agentを付けて中継する（app/api/traces/route.tsのreverseGeocodeRegionと同じ方針）。
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  const limit = req.nextUrl.searchParams.get('limit') ?? '5';
  if (!q || !q.trim()) {
    return NextResponse.json({ ok: false, error: 'q は必須です' }, { status: 400 });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=${encodeURIComponent(limit)}&accept-language=ja&countrycodes=jp`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Hitomap/1.0 (hitomap.info@gmail.com)' } });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: '検索サービスが混み合っています。時間をおいてお試しください' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, candidates: data });
  } catch {
    return NextResponse.json({ ok: false, error: '検索に失敗しました' }, { status: 500 });
  }
}
