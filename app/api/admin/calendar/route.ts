// GET /api/admin/calendar — agents/calendar_watch.py（番人29）が書き出す
// agents/work/calendar_watch.json を読むだけの読み取り専用API。
// app/api/admin/agent-status/route.ts と同じ checkAdmin＋fs読み込みパターン。
// agents/ ディレクトリは会長の開発機だけに存在するため、本番環境では
// ファイルが無く connected:false を返す（静かに何も表示しない設計）。
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

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const filePath = path.join(process.cwd(), 'agents', 'work', 'calendar_watch.json');
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: true, connected: false, today: [], tomorrow: [] });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return NextResponse.json({
      ok: true,
      connected: Boolean(data.connected),
      today: (data.today ?? []) as CalendarEvent[],
      tomorrow: (data.tomorrow ?? []) as CalendarEvent[],
      asOf: data.as_of ?? null,
      error: data.error ?? null,
    });
  } catch {
    return NextResponse.json({ ok: true, connected: false, today: [], tomorrow: [] });
  }
}
