// GET /api/admin/web-analytics — Vercel Web Analytics API を運営ダッシュボードから見るための中継。
// hitomap.com は @vercel/analytics（app/layout.tsx）でページビュー・訪問者を自動計測している。
// そのデータをVercelのダッシュボードに行かずに確認できるようにする。
//
// 必要な環境変数: VERCEL_ANALYTICS_TOKEN（Vercelのアカウント設定→Tokensで発行。
// スコープは"hitomap"チームに絞る。プロジェクトの読み取り専用トークンとして使う）。
// プロジェクトID・チームスロッグは秘密情報ではない（VercelのURLに常に出ている）ためここに固定で書く。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const VERCEL_PROJECT_ID = 'prj_gfyDwk45fDah1bfCU9SX3d88VoQJ';
const VERCEL_TEAM_SLUG = 'hitomap';
const API_BASE = 'https://api.vercel.com/v1/query/web-analytics';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function queryVercel(token: string, path: string, params: Record<string, string>) {
  const search = new URLSearchParams({ slug: VERCEL_TEAM_SLUG, projectId: VERCEL_PROJECT_ID, ...params });
  const res = await fetch(`${API_BASE}/${path}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Vercel API ${path} が失敗しました（${res.status}）`);
  return data;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  if (!token) {
    return NextResponse.json({
      ok: false,
      needsToken: true,
      error: 'VERCEL_ANALYTICS_TOKEN が未設定です。Vercelのアカウント設定→Tokensで発行し、.env.localとVercelの環境変数の両方に追加してください。',
    }, { status: 200 });
  }

  const days = Number(req.nextUrl.searchParams.get('days') ?? 30);
  const since = isoDaysAgo(days);
  const until = isoDaysAgo(0);

  try {
    const [daily, totals, pages, referrers, devices, countries] = await Promise.all([
      queryVercel(token, 'visits/aggregate', { since, until, by: 'day' }),
      queryVercel(token, 'visits/count', { since, until }),
      queryVercel(token, 'visits/aggregate', { since, until, by: 'route', limit: '8' }),
      queryVercel(token, 'visits/aggregate', { since, until, by: 'referrerHostname', limit: '8' }),
      queryVercel(token, 'visits/aggregate', { since, until, by: 'deviceType', limit: '6' }),
      queryVercel(token, 'visits/aggregate', { since, until, by: 'country', limit: '8' }),
    ]);

    return NextResponse.json({
      ok: true,
      since, until, days,
      totals: totals.data,
      daily: daily.data,
      pages: pages.data,
      referrers: referrers.data,
      devices: devices.data,
      countries: countries.data,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '取得に失敗しました' }, { status: 500 });
  }
}
