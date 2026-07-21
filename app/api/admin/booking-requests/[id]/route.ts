// PATCH /api/admin/booking-requests/[id] — 予約リクエストの確定/却下/キャンセル（admin-gated）
// confirm時だけ実際にGoogleカレンダーへイベントを作成する（会長が押した瞬間だけ書き込む）。
// decline/cancelでは申込者へメールで通知する（gmail.sendスコープ、lib/gmailServer.ts）。
import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/adminAuth';

const SUPABASE_READY = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

// メール本文用の日時整形（JST固定。/scheduleページの表示と揃える）
function formatJst(iso: string): string {
  const d = new Date(iso);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()];
  const jst = new Date(d.getTime() + 9 * 3600_000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}(${weekday}) ${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!SUPABASE_READY) return NextResponse.json({ ok: false, error: 'Supabase未設定' }, { status: 503 });
  if (!checkAdmin(req)) return NextResponse.json({ ok: false, error: 'パスワードが違います' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { action?: 'confirm' | 'decline' | 'cancel' };
  if (body.action !== 'confirm' && body.action !== 'decline' && body.action !== 'cancel') {
    return NextResponse.json({ ok: false, error: 'action は confirm・decline・cancel のいずれかを指定してください' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: reqRow, error: fetchError } = await supabaseServer
    .from('booking_requests').select('*').eq('id', params.id).maybeSingle();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!reqRow) return NextResponse.json({ ok: false, error: 'リクエストが見つかりません' }, { status: 404 });

  if (body.action === 'cancel') {
    if (reqRow.status !== 'confirmed') {
      return NextResponse.json({ ok: false, error: '確定済みのリクエストのみキャンセルできます' }, { status: 409 });
    }
    try {
      if (reqRow.calendar_event_id) {
        const { deleteCalendarEvent } = await import('@/lib/googleCalendarServer');
        await deleteCalendarEvent(reqRow.calendar_event_id);
      }
      const { error } = await supabaseServer.from('booking_requests')
        .update({ status: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', params.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      try {
        const { sendEmail } = await import('@/lib/gmailServer');
        await sendEmail({
          to: reqRow.email,
          subject: '【ヒトマップ】ご予約のキャンセルについて',
          body: [
            `${reqRow.name} 様`,
            '',
            `${formatJst(reqRow.requested_start)}〜のご予約について、都合によりキャンセルさせていただくこととなりました。`,
            'ご不便をおかけし申し訳ございません。改めて日程調整ページよりご都合の良い日時をお申し込みください。',
            '',
            'https://hitomap.com/schedule',
            '',
            'ヒトマップ',
          ].join('\n'),
        });
      } catch {
        // メール送信失敗はキャンセル自体を失敗させない（カレンダー削除・DB更新は既に完了しているため）
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'カレンダーの削除に失敗しました';
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  }

  if (reqRow.status !== 'pending') {
    return NextResponse.json({ ok: false, error: 'このリクエストは既に処理済みです' }, { status: 409 });
  }

  if (body.action === 'decline') {
    const { error } = await supabaseServer.from('booking_requests')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    try {
      const { sendEmail } = await import('@/lib/gmailServer');
      await sendEmail({
        to: reqRow.email,
        subject: '【ヒトマップ】ご予約リクエストについて',
        body: [
          `${reqRow.name} 様`,
          '',
          `${formatJst(reqRow.requested_start)}〜のご予約リクエストをいただきありがとうございます。`,
          '大変恐縮ですが、今回はご希望に沿うことができませんでした。',
          '別の日時で改めてお申し込みいただけますと幸いです。',
          '',
          'https://hitomap.com/schedule',
          '',
          'ヒトマップ',
        ].join('\n'),
      });
    } catch {
      // メール送信失敗は却下自体を失敗させない（DB更新は既に完了しているため）
    }
    return NextResponse.json({ ok: true });
  }

  // confirm：ここで初めてGoogleカレンダーへ書き込む
  try {
    const { createCalendarEvent, SCHEDULING_MEET_URL, isSlotFree } = await import('@/lib/googleCalendarServer');

    // 二重予約防止：会長が確定を押した「今」の時点でもう一度空きを確認する
    // （申込〜確定の間に別リクエストが先に確定され、枠が埋まっている可能性があるため）
    const free = await isSlotFree(reqRow.requested_start, reqRow.requested_end);
    if (!free) {
      return NextResponse.json({
        ok: false,
        error: 'この時間帯は既に別の予定で埋まっています。却下するか、別の対応をご検討ください。',
        conflict: true,
      }, { status: 409 });
    }

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
