// GET /api/schedule/availability?duration=30 — 公開・ログイン不要。
// 直近の空き枠を返す（真のGoogle Calendar freeBusy APIを使用）。書き込みは一切しない。
import { NextRequest, NextResponse } from 'next/server';
import { getAvailability } from '@/lib/googleCalendarServer';

const ALLOWED_DURATIONS = [15, 30, 45, 60];
const DAYS_AHEAD = 10;

export async function GET(req: NextRequest) {
  const durationParam = Number(req.nextUrl.searchParams.get('duration'));
  const duration = ALLOWED_DURATIONS.includes(durationParam) ? durationParam : 30;

  try {
    const days = await getAvailability(DAYS_AHEAD, duration);
    return NextResponse.json({ ok: true, duration, days });
  } catch (e) {
    const message = e instanceof Error ? e.message : '空き状況の取得に失敗しました';
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
