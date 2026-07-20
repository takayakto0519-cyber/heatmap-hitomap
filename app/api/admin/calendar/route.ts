// GET /api/admin/calendar — 直近2週間分のGoogleカレンダー予定を返す読み取り専用API。
// 優先順位は3段階：
//   1. GOOGLE_CALENDAR_REFRESH_TOKEN（lib/googleCalendarServer.ts、書き込みスコープの環境変数）が
//      設定済みなら、Googleカレンダーからライブで取得する。本番（Vercel）でも動き、ダッシュボードから
//      予定を追加した直後にも反映される（POST /api/admin/calendar-events参照）。
//   2. 未設定の場合、agents/calendar_watch.py（番人29・読み取り専用スコープ、会長のPC専用）が
//      書き出した agents/work/calendar_watch.json をローカルファイルとして直接読む。
//   3. それも無ければ、agents/sync_status_to_supabase.py が1時間おきに書き込む
//      agent_status_snapshot テーブルの calendar_watch 行を読む（app/api/admin/agent-statusと同じ手）。
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface CalendarEvent {
  title: string;
  start: string | null;
  end: string | null;
  all_day: boolean;
  location: string;
  html_link: string;
}

interface CalendarDay {
  date: string;
  events: CalendarEvent[];
}

interface CalendarResult {
  connected?: boolean;
  days?: CalendarDay[];
  today?: CalendarEvent[];
  tomorrow?: CalendarEvent[];
  as_of?: string | null;
  error?: string | null;
}

function toResponse(data: CalendarResult, extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    ok: true,
    connected: Boolean(data.connected),
    days: (data.days ?? []) as CalendarDay[],
    today: (data.today ?? []) as CalendarEvent[],
    tomorrow: (data.tomorrow ?? []) as CalendarEvent[],
    asOf: data.as_of ?? null,
    error: data.error ?? null,
    ...extra,
  });
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  if (process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    try {
      const { listUpcomingEventsGrouped } = await import('@/lib/googleCalendarServer');
      const days = await listUpcomingEventsGrouped();
      return toResponse({
        connected: true,
        days,
        today: days[0]?.events ?? [],
        tomorrow: days[1]?.events ?? [],
        as_of: new Date().toISOString(),
      }, { live: true });
    } catch (e) {
      // 環境変数はあってもトークン失効等で失敗することがある。下のフォールバックへ静かに続ける。
      console.error('[calendar] live fetch failed, falling back:', e);
    }
  }

  const filePath = path.join(process.cwd(), 'agents', 'work', 'calendar_watch.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CalendarResult;
      return toResponse(data, { local: true });
    } catch {
      // 壊れたファイルは無視して下のフォールバックへ
    }
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { supabaseServer } = await import('@/lib/supabase/server');
      const { data, error } = await supabaseServer
        .from('agent_status_snapshot')
        .select('result, synced_at')
        .eq('agent_id', 'calendar_watch')
        .maybeSingle();
      if (!error && data?.result) {
        return toResponse(data.result as CalendarResult, { local: false, syncedAt: data.synced_at });
      }
    } catch {
      // Supabase未設定・テーブル未作成でもエラーにはせず、下のconnected:falseにフォールバックする
    }
  }

  return NextResponse.json({ ok: true, connected: false, days: [], today: [], tomorrow: [] });
}
