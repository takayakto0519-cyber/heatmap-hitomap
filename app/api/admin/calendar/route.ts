// GET /api/admin/calendar — agents/calendar_watch.py（番人29）が同期する
// 直近2週間分のGoogleカレンダー予定を返す読み取り専用API。
// ローカル（会長のPC）では agents/work/calendar_watch.json を直接読む。
// hitomap.com（本番）等、そのファイルが存在しない環境では、
// agents/sync_status_to_supabase.py が1時間おきに書き込む agent_status_snapshot
// テーブルの calendar_watch 行を代わりに読む（app/api/admin/agent-status と同じフォールバック）。
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
