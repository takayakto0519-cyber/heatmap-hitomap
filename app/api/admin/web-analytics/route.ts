// GET /api/admin/web-analytics — Vercel Web Analytics API を運営ダッシュボードから見るための中継。
// hitomap.com は @vercel/analytics（app/layout.tsx）でページビュー・訪問者を自動計測している。
// そのデータをVercelのダッシュボードに行かずに確認できるようにする。
//
// 必要な環境変数: VERCEL_ANALYTICS_TOKEN（Vercelのアカウント設定→Tokensで発行。
// スコープは"hitomap"チームに絞る。プロジェクトの読み取り専用トークンとして使う）。
// プロジェクトID・チームスロッグは秘密情報ではない（VercelのURLに常に出ている）ためここに固定で書く。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const VERCEL_PROJECT_ID = 'prj_gfyDwk45fDahlbfCU9SX3d88VoQJ';
const VERCEL_TEAM_SLUG = 'hitomap';
const API_BASE = 'https://api.vercel.com/v1/query/web-analytics';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// by は複数指定できる（例: referrerHostname と requestPath の掛け合わせ＝クロス集計）。
// Vercel側はカンマ区切りではなく by= を複数回渡す形式を期待するため、配列で受けて都度追加する。
async function queryVercel(token: string, path: string, params: Record<string, string>, by?: string | string[]) {
  const search = new URLSearchParams({ slug: VERCEL_TEAM_SLUG, projectId: VERCEL_PROJECT_ID, ...params });
  for (const b of by ? (Array.isArray(by) ? by : [by]) : []) search.append('by', b);
  const res = await fetch(`${API_BASE}/${path}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Vercel API ${path} が失敗しました（${res.status}）`);
  return data;
}

interface HourRow { timestamp: string; pageviews: number; visitors: number }

// hour単位のaggregateはlimit<=100の制約があるため、長い期間を一括では取れない
// （例: 31日 = 744時間）。日本時間の「何時に見られているか」を知りたいだけなので、
// 直近4日分（96時間）だけ取ってJSTの時間帯に振り分ける。
function bucketByJstHour(rows: HourRow[]): { hour: number; pageviews: number; visitors: number }[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, pageviews: 0, visitors: 0 }));
  for (const row of rows) {
    const utcHour = new Date(row.timestamp).getUTCHours();
    const jstHour = (utcHour + 9) % 24;
    buckets[jstHour].pageviews += row.pageviews;
    buckets[jstHour].visitors += row.visitors;
  }
  return buckets;
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

  // VercelのHobbyプランはWeb Analytics APIで直近31日分までしか見られない
  // （"the hobby plan only grants access to the latest 31 days of data"）。
  // それを超える範囲を渡すと400になるので、ここで必ず31日以内に丸める。
  const days = Math.min(31, Number(req.nextUrl.searchParams.get('days') ?? 30));
  const since = isoDaysAgo(days);
  const until = isoDaysAgo(0);

  // 時間帯（時刻ごと）は集計行数の上限(100行)にすぐ当たるため、直近の短い固定期間だけで見る。
  const hourlySince = isoDaysAgo(Math.min(days, 4));

  try {
    const [daily, totals, pages, referrers, devices, countries, os, hourly, referrerPages] = await Promise.all([
      queryVercel(token, 'visits/aggregate', { since, until }, 'day'),
      queryVercel(token, 'visits/count', { since, until }),
      // by: 'route' はこのプロジェクトでは常に空文字1行しか返らなかった（App Routerの
      // ルートパターン名が未設定のため？）。実URLそのものである requestPath を使う。
      queryVercel(token, 'visits/aggregate', { since, until, limit: '8' }, 'requestPath'),
      queryVercel(token, 'visits/aggregate', { since, until, limit: '8' }, 'referrerHostname'),
      queryVercel(token, 'visits/aggregate', { since, until, limit: '6' }, 'deviceType'),
      queryVercel(token, 'visits/aggregate', { since, until, limit: '8' }, 'country'),
      queryVercel(token, 'visits/aggregate', { since, until, limit: '6' }, 'osName'),
      queryVercel(token, 'visits/aggregate', { since: hourlySince, until, limit: '100' }, 'hour'),
      // 「どのサイトから来た人が、どのページを最初に見たか」のクロス集計。他サイト運営者が
      // 参考にしているページ＝HP改善のヒントになる。referrerHostnameは取れてもURLそのもの
      // （どの記事か等）はAPIから取得できないため、これが読み取れる限界。
      queryVercel(token, 'visits/aggregate', { since, until, limit: '15' }, ['referrerHostname', 'requestPath']),
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
      os: os.data,
      hourly: bucketByJstHour(hourly.data as HourRow[]),
      hourlyRangeDays: Math.min(days, 4),
      referrerPages: referrerPages.data,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '取得に失敗しました' }, { status: 500 });
  }
}
