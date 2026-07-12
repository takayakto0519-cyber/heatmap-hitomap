// GET /api/geocode/reverse?lat=...&lon=... — 座標→住所の逆引きをサーバー側でプロキシする
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');
  if (!lat || !lon) {
    return NextResponse.json({ ok: false, error: 'lat・lon は必須です' }, { status: 400 });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json&addressdetails=1&accept-language=ja`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Hitomap/1.0 (hitomap.info@gmail.com)' } });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: '検索サービスが混み合っています。時間をおいてお試しください' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, result: data });
  } catch {
    return NextResponse.json({ ok: false, error: '検索に失敗しました' }, { status: 500 });
  }
}
