// /api/reports : 通報の受け口（POSTのみ、公開）
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient, getCurrentUserId } from '@/lib/supabase/requestClient';
import { notifyDiscord } from '@/lib/discord';

const REASONS = ['inappropriate', 'spam', 'personal_info', 'copyright', 'other'] as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    trace_id?: string; reason?: string; note?: string; reporter_session?: string;
  };
  if (!body.trace_id) return NextResponse.json({ ok: false, error: 'trace_id は必須です' }, { status: 400 });
  if (!body.reason || !(REASONS as readonly string[]).includes(body.reason)) {
    return NextResponse.json({ ok: false, error: 'reason が不正です' }, { status: 400 });
  }

  const myId = await getCurrentUserId();
  const supabase = createRequestClient();
  const { error } = await supabase.from('trace_reports').insert({
    trace_id: body.trace_id,
    reporter_id: myId,
    reporter_session: myId ? null : (body.reporter_session ?? null),
    reason: body.reason,
    note: body.note?.trim() || null,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  notifyDiscord(`⚠ 投稿が通報されました\n理由: ${body.reason}${body.note ? `\n${body.note}` : ''}\n運営ダッシュボードの「通報」タブから確認してください`);

  return NextResponse.json({ ok: true });
}
