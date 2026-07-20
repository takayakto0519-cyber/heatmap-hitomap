// POST /api/admin/calendar-events — 運営ダッシュボードからGoogleカレンダーに予定を追加する。
// lib/googleCalendarServer.ts の createCalendarEvent（書き込みスコープ・環境変数ベース）を使う。
// GOOGLE_CALENDAR_CLIENT_ID/SECRET/REFRESH_TOKEN が未設定の環境では 503 を返す
// （scripts/setup-google-calendar-oauth.mjs の手順が必要）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  if (!process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    return NextResponse.json({
      ok: false,
      error: 'Googleカレンダー書き込み用の環境変数が未設定です。scripts/setup-google-calendar-oauth.mjs の手順を行ってください。',
      needsSetup: true,
    }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as {
    title?: string; assignee?: string; date?: string; startTime?: string; endTime?: string; memo?: string;
  };
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });
  if (!body.date || !body.startTime || !body.endTime) {
    return NextResponse.json({ ok: false, error: '日付・開始時刻・終了時刻は必須です' }, { status: 400 });
  }

  const startTime = `${body.date}T${body.startTime}:00+09:00`;
  const endTime = `${body.date}T${body.endTime}:00+09:00`;
  if (endTime <= startTime) {
    return NextResponse.json({ ok: false, error: '終了時刻は開始時刻より後にしてください' }, { status: 400 });
  }

  try {
    const { createCalendarEvent } = await import('@/lib/googleCalendarServer');
    const result = await createCalendarEvent({
      summary: body.title.trim(),
      description: body.memo?.trim() || undefined,
      startTime,
      endTime,
      assignee: body.assignee?.trim() || undefined,
    });
    return NextResponse.json({ ok: true, id: result.id, htmlLink: result.htmlLink });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
