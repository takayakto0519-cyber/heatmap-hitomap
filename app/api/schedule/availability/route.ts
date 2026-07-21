// GET /api/schedule/availability?duration=30&month=2026-07 — 公開・ログイン不要。
// 指定月（省略時は当月）の空き枠を月間カレンダーグリッド用に返す
// （真のGoogle Calendar freeBusy APIを使用）。書き込みは一切しない。
//
// 予約可能な範囲は「今日〜MAX_MONTHS_AHEADヶ月先の月末」までにクランプする
// （それより前・後の月をリクエストされても、範囲内の月にまるめて返す）。
import { NextRequest, NextResponse } from 'next/server';
import { getAvailability } from '@/lib/googleCalendarServer';

const ALLOWED_DURATIONS = [15, 30, 45, 60];
const MAX_MONTHS_AHEAD = 2;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function monthKey(y: number, m: number): string {
  return `${y}-${pad2(m)}`;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// JSTの「今日」を求める（サーバーの実行タイムゾーンに依存させないため素朴に+9hして取り出す）
function todayJst(): { y: number; m: number; d: number } {
  const jst = new Date(Date.now() + 9 * 3600_000);
  return { y: jst.getUTCFullYear(), m: jst.getUTCMonth() + 1, d: jst.getUTCDate() };
}

export async function GET(req: NextRequest) {
  const durationParam = Number(req.nextUrl.searchParams.get('duration'));
  const duration = ALLOWED_DURATIONS.includes(durationParam) ? durationParam : 30;

  const today = todayJst();
  const minMonth = { y: today.y, m: today.m };
  const maxMonthDate = new Date(Date.UTC(today.y, today.m - 1 + MAX_MONTHS_AHEAD, 1));
  const maxMonth = { y: maxMonthDate.getUTCFullYear(), m: maxMonthDate.getUTCMonth() + 1 };

  const monthParam = req.nextUrl.searchParams.get('month'); // "YYYY-MM"
  let targetY = today.y;
  let targetM = today.m;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [py, pm] = monthParam.split('-').map(Number);
    if (pm >= 1 && pm <= 12) {
      targetY = py;
      targetM = pm;
    }
  }
  // 範囲外の月は今日の月〜MAX_MONTHS_AHEADヶ月先の月末にクランプする
  if (monthKey(targetY, targetM) < monthKey(minMonth.y, minMonth.m)) {
    targetY = minMonth.y;
    targetM = minMonth.m;
  } else if (monthKey(targetY, targetM) > monthKey(maxMonth.y, maxMonth.m)) {
    targetY = maxMonth.y;
    targetM = maxMonth.m;
  }

  // その月の最初〜最後の日（今月分は今日から、というのはgetAvailability内のisPast判定に任せる。
  // ここでは月の1日〜末日をそのまま範囲として渡し、過去日はslots:[]で返ってくる想定）
  const fromDate = `${targetY}-${pad2(targetM)}-01`;
  const toDate = `${targetY}-${pad2(targetM)}-${pad2(lastDayOfMonth(targetY, targetM))}`;

  try {
    const days = await getAvailability(fromDate, toDate, duration);
    return NextResponse.json({
      ok: true,
      duration,
      month: monthKey(targetY, targetM),
      minMonth: monthKey(minMonth.y, minMonth.m),
      maxMonth: monthKey(maxMonth.y, maxMonth.m),
      days,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '空き状況の取得に失敗しました';
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
