// PATCH /api/admin/calendar-events/[id] — 既存の予定に担当者バッジ（[名前]プレフィックス）を
// 後から付け直す。会長がGoogleカレンダー側で直接追加した予定は担当者不明のまま表示されるため、
// ダッシュボード上でその場で「誰の予定か」を設定できるようにする。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  if (!process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    return NextResponse.json({
      ok: false,
      error: 'Googleカレンダー書き込み用の環境変数が未設定です。scripts/setup-google-calendar-oauth.mjs の手順を行ってください。',
      needsSetup: true,
    }, { status: 503 });
  }

  const { id } = context.params;
  const body = await req.json().catch(() => ({})) as { title?: string; assignee?: string | null };
  if (!body.title?.trim()) return NextResponse.json({ ok: false, error: 'タイトルは必須です' }, { status: 400 });

  try {
    const { updateCalendarEventAssignee } = await import('@/lib/googleCalendarServer');
    await updateCalendarEventAssignee(id, body.title.trim(), body.assignee?.trim() || null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
