// PATCH /api/appointments/[id] { status: 'accepted' | 'declined' } — 申請への回答（受信者のみ）
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/supabase/requestClient';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const myId = await getCurrentUserId();
  if (!myId) return NextResponse.json({ ok: false, error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { status?: 'accepted' | 'declined' };
  if (body.status !== 'accepted' && body.status !== 'declined') {
    return NextResponse.json({ ok: false, error: 'status は accepted か declined を指定してください' }, { status: 400 });
  }

  const { supabaseServer } = await import('@/lib/supabase/server');
  const { data: existing, error: fetchError } = await supabaseServer
    .from('appointment_requests')
    .select('id, requester_id, requestee_id, status')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ ok: false, error: '申請が見つかりません' }, { status: 404 });
  if (existing.requestee_id !== myId) return NextResponse.json({ ok: false, error: '回答できるのは申請を受け取った本人のみです' }, { status: 403 });
  if (existing.status !== 'pending') return NextResponse.json({ ok: false, error: 'この申請は既に回答済みです' }, { status: 400 });

  const { data, error } = await supabaseServer
    .from('appointment_requests')
    .update({ status: body.status, responded_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id, requester_id, requestee_id, trace_id, purpose, status, created_at, responded_at')
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabaseServer.from('notifications').insert({
    user_id: existing.requester_id,
    type: 'appointment_request',
    message: body.status === 'accepted' ? '会ってみたいという申請が承認されました' : '会ってみたいという申請が見送られました',
  });

  return NextResponse.json({ ok: true, request: data });
}
