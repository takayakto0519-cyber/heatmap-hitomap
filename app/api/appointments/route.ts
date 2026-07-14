// /api/appointments : 「会ってみたい」アポ申請（相互フォロー不要）
//   GET  ... 自分が送った/受け取った申請一覧
//   POST { requestee_id, purpose, trace_id? } ... 申請を送る
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';

export async function GET() {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const [{ data: sent, error: sentError }, { data: received, error: receivedError }] = await Promise.all([
    supabaseServer
      .from('appointment_requests')
      .select('id, requester_id, requestee_id, trace_id, purpose, status, created_at, responded_at')
      .eq('requester_id', myId)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('appointment_requests')
      .select('id, requester_id, requestee_id, trace_id, purpose, status, created_at, responded_at')
      .eq('requestee_id', myId)
      .order('created_at', { ascending: false }),
  ]);
  if (sentError || receivedError) {
    return NextResponse.json({ ok: false, error: (sentError ?? receivedError)?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sent: sent ?? [], received: received ?? [] });
}

export async function POST(req: NextRequest) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    requestee_id?: string; purpose?: string; trace_id?: string;
  };
  if (!body.requestee_id) return NextResponse.json({ ok: false, error: 'requestee_id は必須です' }, { status: 400 });
  if (body.requestee_id === myId) return NextResponse.json({ ok: false, error: '自分自身には申請できません' }, { status: 400 });
  const purpose = (body.purpose ?? '').trim();
  if (!purpose) return NextResponse.json({ ok: false, error: '会いたい理由を書いてください' }, { status: 400 });
  if (purpose.length > 300) return NextResponse.json({ ok: false, error: '300字以内で書いてください' }, { status: 400 });

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data, error } = await supabaseServer
    .from('appointment_requests')
    .insert({
      requester_id: myId,
      requestee_id: body.requestee_id,
      trace_id: body.trace_id ?? null,
      purpose,
    })
    .select('id, requester_id, requestee_id, trace_id, purpose, status, created_at')
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabaseServer.from('notifications').insert({
    user_id: body.requestee_id,
    type: 'appointment_request',
    trace_id: body.trace_id ?? null,
    message: '会ってみたいという申請が届きました',
  });

  return NextResponse.json({ ok: true, request: data });
}
