// PATCH /api/admin/booking-requests/[id] — 予約リクエストの確定/却下（admin-gated）
// confirm時だけ実際にGoogleカレンダーへイベントを作成する（会長が押した瞬間だけ書き込む）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: 'confirm' | 'decline' };
  if (body.action !== 'confirm' && body.action !== 'decline') {
    return NextResponse.json({ ok: false, error: 'action は confirm か decline を指定してください' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: reqRow, error: fetchError } = await supabaseServer
    .from('booking_requests').select('*').eq('id', params.id).maybeSingle();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!reqRow) return NextResponse.json({ ok: false, error: 'リクエストが見つかりません' }, { status: 404 });
  if (reqRow.status !== 'pending') {
    return NextResponse.json({ ok: false, error: 'このリクエストは既に処理済みです' }, { status: 409 });
  }

  if (body.action === 'decline') {
    const { error } = await supabaseServer.from('booking_requests')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // confirm：ここで初めてGoogleカレンダーへ書き込む
  try {
    const { createCalendarEvent, SCHEDULING_MEET_URL } = await import('@/lib/googleCalendarServer');
    const event = await createCalendarEvent({
      summary: `${reqRow.name}様${reqRow.company ? `（${reqRow.company}）` : ''}`,
      description: reqRow.purpose ? `用件：${reqRow.purpose}\n\nヒトマップ日程調整ページからの予約` : 'ヒトマップ日程調整ページからの予約',
      startTime: reqRow.requested_start,
      endTime: reqRow.requested_end,
      attendeeEmail: reqRow.email,
      location: SCHEDULING_MEET_URL,
    });
    const { error } = await supabaseServer.from('booking_requests')
      .update({ status: 'confirmed', calendar_event_id: event.id, responded_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, calendarEventLink: event.htmlLink });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'カレンダーへの登録に失敗しました';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
